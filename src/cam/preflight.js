/**
 * Gcoded CAM - Verificações Pré-Voo (Preflight Safety Checks)
 * Inspirado no `preflight.rs` do Cut-Craft:
 * Deteta colisões de profundidade, limites de cone em V-Bit, avanços inválidos,
 * trocas de ferramenta necessárias e ordens sem vetores antes de enviar para a CNC.
 */
(function (root) {
  'use strict';

  function getToolpaths() {
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      return require('./toolpaths.js');
    }
    return root.GcodedCAM && root.GcodedCAM.toolpaths;
  }

  /**
   * Executa todas as verificações de segurança sobre as ordens de trabalho ativas.
   * Devolve { ok: boolean, errors: [], warnings: [], info: [] }
   */
  function runPreflightChecks(operations, jobConfig = {}) {
    const tp = getToolpaths();
    const materialZ = Math.max(0.5, parseFloat(jobConfig.materialZ) || 10.0);
    const errors = [];
    const warnings = [];
    const info = [];

    if (!operations || operations.length === 0) {
      return { ok: true, errors, warnings, info };
    }

    let lastToolName = null;

    operations.forEach((op, idx) => {
      if (!op || op.enabled === false) return;
      const opLabel = op.name || `Ordem ${idx + 1}`;
      const tool = op.tool || {};
      const params = op.params || {};
      const strategy = op.strategy || 'outside';

      const toolDia = parseFloat(tool.dia);
      const feedXY = parseFloat(tool.feedXY);
      const feedZ = parseFloat(tool.feedZ);
      const safeZ = params.safeZ !== undefined ? parseFloat(params.safeZ) : 5.0;
      const depthTotal = params.depthTotal !== undefined ? parseFloat(params.depthTotal) : -3.0;
      const depthPass = params.depthPass !== undefined ? parseFloat(params.depthPass) : 1.0;

      // 1. Validar parâmetros da ferramenta
      if (isNaN(toolDia) || toolDia <= 0) {
        errors.push({
          opId: op.id,
          code: 'invalid_tool_dia',
          message: `[${opLabel}] O diâmetro da fresa tem de ser maior que 0 mm.`
        });
      }
      if (isNaN(feedXY) || feedXY <= 0 || isNaN(feedZ) || feedZ <= 0) {
        errors.push({
          opId: op.id,
          code: 'invalid_feed',
          message: `[${opLabel}] Os avanços XY e de mergulho Z têm de ser maiores que 0 mm/min.`
        });
      }
      if (isNaN(depthPass) || depthPass <= 0) {
        warnings.push({
          opId: op.id,
          code: 'invalid_pass_depth',
          message: `[${opLabel}] Passo de descida Z inválido (${params.depthPass}); será ajustado automaticamente para 1.0 mm.`
        });
      }

      // 2. Z de Segurança baixo
      if (safeZ < 1.0) {
        warnings.push({
          opId: op.id,
          code: 'low_safe_z',
          message: `[${opLabel}] Z de Segurança muito baixo (${safeZ} mm). Recomenda-se ≥ 3.0 mm para evitar colisão com grampos.`
        });
      }

      // 3. Verificação específica de Chanfro (V-Bit beyondTheV)
      if (strategy === 'chamfer' && tp && tp.computeChamferGeometry) {
        const ch = tp.computeChamferGeometry({
          chamferWidth: params.chamferWidth,
          chamferAngle: params.chamferAngle,
          chamferTipOffset: params.chamferTipOffset,
          startDepth: params.startDepth,
          chamferSide: params.chamferSide,
          toolDia: toolDia || 6.0
        });
        if (ch.beyondTheV) {
          errors.push({
            opId: op.id,
            code: 'chamfer_beyond_v',
            message: `[${opLabel}] ${ch.beyondTheV.message}`
          });
        }
        if (Math.abs(ch.zCut) > materialZ + 0.5) {
          warnings.push({
            opId: op.id,
            code: 'chamfer_through_material',
            message: `[${opLabel}] A ponta da V-Bit desce até ${ch.zCut.toFixed(2)} mm (material tem ${materialZ} mm) — vai marcar a mesa mártir.`
          });
        }
      } else {
        // 4. Profundidade vs Espessura do Material (Outras estratégias)
        const absDepth = Math.abs(depthTotal);
        if (absDepth > materialZ + 1.0) {
          errors.push({
            opId: op.id,
            code: 'depth_exceeds_material',
            message: `[${opLabel}] Profundidade (${absDepth.toFixed(2)} mm) excede em mais de 1 mm a espessura do material (${materialZ} mm). Reduz a profundidade ou aumenta a espessura da chapa.`
          });
        } else if (absDepth > materialZ) {
          warnings.push({
            opId: op.id,
            code: 'cuts_spoilboard',
            message: `[${opLabel}] Corte passante de ${absDepth.toFixed(2)} mm entra ${(absDepth - materialZ).toFixed(2)} mm na mesa mártir (spoilboard).`
          });
        }
      }

      // 5. Vetores associados (quando definidos explicitamente)
      if (Array.isArray(op.targetObjectUids) && op.targetObjectUids.length === 0) {
        warnings.push({
          opId: op.id,
          code: 'no_vectors',
          message: `[${opLabel}] Sem vetores associados — esta ordem não vai gerar corte.`
        });
      }

      // 6. Aviso informativo de troca de ferramenta
      const toolName = tool.name || `Fresa Ø${toolDia}mm`;
      if (lastToolName && lastToolName !== toolName) {
        info.push({
          opId: op.id,
          code: 'tool_change',
          message: `Troca de ferramenta (M0) antes de "${opLabel}": mudar para ${toolName}.`
        });
      }
      lastToolName = toolName;
    });

    return {
      ok: errors.length === 0,
      errors,
      warnings,
      info
    };
  }

  /**
   * Formata segundos em texto legível (ex: "2m 15s" ou "42s").
   */
  function formatDuration(totalSeconds) {
    if (!totalSeconds || totalSeconds < 1) return '< 1s';
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.round(totalSeconds % 60);
    if (mins === 0) return `${secs}s`;
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `${hrs}h ${remMins}m`;
    }
    return `${mins}m ${secs}s`;
  }

  const api = {
    runPreflightChecks,
    formatDuration
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.GcodedCAM = Object.assign(root.GcodedCAM || {}, { preflight: api });
  }
})(typeof window !== 'undefined' ? window : globalThis);
