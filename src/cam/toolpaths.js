/**
 * Gcoded CAM - Motor de Estratégias de Percurso (Inspirado no Cut-Craft)
 * Implementa Perfil (Exterior/Interior/Na Linha), Pocket (Concêntrico Centro→Fora, Fora→Centro, Raster),
 * Chanfro (matemática exata de V-Bit com deteção de limite do cone), e Furação (Peck Drilling).
 */
(function (root) {
  'use strict';

  function getGeo() {
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      return require('./geometry.js');
    }
    return root.GcodedCAM && root.GcodedCAM.geometry;
  }

  /**
   * Calcula a geometria exata de um chanfro com fresa V-Bit (baseado em Cut-Craft chamfer-toolpath).
   *
   * Para uma fresa V-Bit de ângulo incluído `angle` (ex: 90° -> inclinação 45°):
   * - Altura do chanfro = width / tan(angle / 2)
   * - Overcut (folga da ponta) desloca a ponta para fora e para baixo ao longo da rampa:
   *     outOffset = width + overcut   (para rampa a descer a partir da aresta)
   *     zCut = -(startDepth + (width + overcut) / tan(angle / 2))
   * - Verifica se o corte excede a altura do cone da fresa (beyondTheV):
   *     maxVDepth = (toolDia / 2) / tan(angle / 2)
   */
  function computeChamferGeometry(params = {}) {
    const width = Math.max(0.1, parseFloat(params.chamferWidth) || 1.0);
    const angle = Math.max(10, Math.min(170, parseFloat(params.chamferAngle) || 90));
    const overcut = Math.max(0, parseFloat(params.chamferTipOffset) || 0.5);
    const startDepth = Math.max(0, Math.abs(parseFloat(params.startDepth) || 0));
    const side = params.chamferSide || 'outside';
    const toolDia = Math.max(0.5, parseFloat(params.toolDia) || 6.0);

    const halfAngleRad = (angle / 2) * (Math.PI / 180);
    const tanHalf = Math.tan(halfAngleRad) || 1.0;

    const chamferHeight = width / tanHalf;
    const overcutDepth = overcut / tanHalf;
    const deepest = startDepth + chamferHeight + overcutDepth;
    const zCut = -deepest;

    // Desfasamento horizontal exato da ponta da V-Bit em relação ao vetor
    const outDist = width + overcut;
    let signedOffset = 0;
    if (side === 'outside') {
      signedOffset = outDist;
    } else if (side === 'inside') {
      signedOffset = -outDist;
    } else {
      // Centrado na aresta: apenas metade da largura
      signedOffset = 0;
    }

    // Verificação Cut-Craft "beyond_the_v": o cone da V-bit tem altura R / tan(halfAngle)
    const maxVDepth = (toolDia / 2) / tanHalf;
    let beyondTheV = null;
    if (deepest > maxVDepth + 1e-4) {
      const roomDepth = maxVDepth - startDepth - overcutDepth;
      const maxFittingWidth = Math.max(0, Math.floor((roomDepth * tanHalf) * 100) / 100);
      beyondTheV = {
        deepest: Number(deepest.toFixed(2)),
        maxVDepth: Number(maxVDepth.toFixed(2)),
        maxFittingWidth,
        message: maxFittingWidth > 0.05
          ? `O chanfro atinge ${deepest.toFixed(2)} mm mas o cone da V-Bit (Ø${toolDia}mm ${angle}°) só tem ${maxVDepth.toFixed(2)} mm de altura. Reduz a largura para ≤ ${maxFittingWidth.toFixed(2)} mm ou escolhe uma V-Bit maior.`
          : `A folga de ponta (${overcut}mm) + profundidade inicial excedem o cone da V-Bit (Ø${toolDia}mm ${angle}°). Reduz a folga de ponta ou usa uma V-Bit de maior diâmetro.`
      };
    }

    return {
      width,
      angle,
      overcut,
      startDepth,
      side,
      chamferHeight: Number(chamferHeight.toFixed(4)),
      zCut: Number(zCut.toFixed(4)),
      signedOffset: Number(signedOffset.toFixed(4)),
      maxVDepth: Number(maxVDepth.toFixed(4)),
      beyondTheV
    };
  }

  /**
   * Gera os percursos de Perfil (Exterior, Interior ou Sobre a Linha) com sobreespessura e sentido Climb/Conventional.
   */
  function generateProfileLoops(points, strategy, toolRadius, options = {}) {
    const geo = getGeo();
    if (!points || points.length < 2) return [];

    const closed = geo.isClosedLoop(points, 0.1);
    const allowance = parseFloat(options.allowance) || 0;
    const cutDirection = options.cutDirection || 'climb';

    let loops = [];
    if (!closed || strategy === 'on') {
      loops = [points];
    } else if (strategy === 'outside') {
      loops = geo.offsetContour(points, toolRadius + allowance);
    } else if (strategy === 'inside') {
      loops = geo.offsetContour(points, -(toolRadius + allowance));
    } else {
      loops = [points];
    }

    if (closed && strategy !== 'on') {
      loops = loops.map(l => geo.ensureWinding(l, cutDirection, strategy));
    }
    return loops;
  }

  /**
   * Gera percursos de Desbaste de Caixa / Cavidade (Pocket) — inspirado no Cut-Craft:
   * - 'offset-middle-out': anéis concêntricos cortados do centro para a parede exterior (ideal para CNC)
   * - 'offset-outline-in': anéis concêntricos da parede exterior para o centro
   * - 'raster': linhas paralelas zig-zag + passagem de acabamento limpa na parede exterior
   */
  function generatePocketLoops(points, toolDia, options = {}) {
    const geo = getGeo();
    if (!points || points.length < 3) return [];

    const safeDia = Math.max(0.5, parseFloat(toolDia) || 3.175);
    const toolRadius = safeDia / 2;
    const stepoverPercent = Math.max(5, Math.min(95, parseFloat(options.stepover) || 40));
    const step = Math.max(0.2, safeDia * (stepoverPercent / 100));
    const pattern = options.pocketPattern || 'offset-middle-out';
    const allowance = parseFloat(options.allowance) || 0;
    const cutDirection = options.cutDirection || 'climb';
    const rasterAngle = parseFloat(options.rasterAngle) || 0;

    // 1. Modo Raster (Linhas paralelas + acabamento da parede)
    if (pattern === 'raster') {
      const boundaryLoops = geo.offsetContour(points, -(toolRadius + allowance));
      if (!boundaryLoops || boundaryLoops.length === 0) return [];

      const result = [];
      for (const bound of boundaryLoops) {
        // Recuar ligeiramente para o desbaste raster não riscar a parede antes da passagem final
        const innerRasterBounds = geo.offsetContour(bound, -Math.min(0.15, step * 0.2));
        const rasterTarget = (innerRasterBounds && innerRasterBounds.length > 0) ? innerRasterBounds[0] : bound;
        const lines = geo.generateRasterLines(rasterTarget, step, rasterAngle);
        lines.forEach(seg => result.push(seg));
        // Passagem de acabamento limpa na parede
        result.push(geo.ensureWinding(bound, cutDirection, 'pocket'));
      }
      return result;
    }

    // 2. Modo Concêntrico (Offset Rings)
    const ringsByPass = [];
    let currentOffset = -(toolRadius + allowance);
    let prevTotalArea = Math.abs(geo.signedArea(points));

    // Limite seguro de 80 anéis concêntricos para evitar qualquer lentidão
    for (let pass = 0; pass < 80; pass++) {
      const loops = geo.offsetContour(points, currentOffset);
      if (!loops || loops.length === 0) break;

      let passArea = 0;
      const validLoops = [];
      for (const loop of loops) {
        if (loop && loop.length >= 3) {
          const a = Math.abs(geo.signedArea(loop));
          if (a > 0.25) {
            passArea += a;
            validLoops.push(geo.ensureWinding(loop, cutDirection, 'pocket'));
          }
        }
      }

      if (validLoops.length === 0 || passArea >= prevTotalArea * 1.05) {
        break;
      }

      ringsByPass.push(validLoops);
      prevTotalArea = passArea;
      currentOffset -= step;
    }

    if (ringsByPass.length === 0) return [];

    // Centro → Fora (Cut-Craft MiddleOut) inverte a ordem dos anéis para a fresa limpar do interior até à parede final
    if (pattern === 'offset-middle-out') {
      ringsByPass.reverse();
    }

    const toolpaths = [];
    for (const ringGroup of ringsByPass) {
      for (const loop of ringGroup) {
        toolpaths.push(loop);
      }
    }
    return toolpaths;
  }

  /**
   * Gera comandos G-code de Furação com Quebra-Cavaco (Peck Drilling) no centro de um contorno/círculo.
   */
  function generateDrillGCode(centerMM, opSettings) {
    const geo = getGeo();
    const { safeZ, depthTotal, depthPass, feedZ, startDepth = 0 } = opSettings;
    const zPasses = geo.calculateSafeZPasses(depthPass, depthTotal, startDepth);
    const lines = [];

    lines.push(`G0 Z${safeZ.toFixed(3)}`);
    lines.push(`G0 X${centerMM.x.toFixed(3)} Y${centerMM.y.toFixed(3)}`);

    const retractZ = Math.min(safeZ, Math.max(1.0, Math.abs(startDepth) + 1.5));
    zPasses.forEach((zVal) => {
      lines.push(`G1 Z${zVal.toFixed(3)} F${feedZ.toFixed(0)}`);
      lines.push(`G0 Z${retractZ.toFixed(3)}`);
    });
    lines.push(`G0 Z${safeZ.toFixed(3)}`);

    return lines;
  }

  /**
   * Calcula o centro geométrico (bounding-box center) de um conjunto de pontos em mm.
   */
  function getPointsCenter(mmPoints) {
    if (!mmPoints || mmPoints.length === 0) return { x: 0, y: 0 };
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of mmPoints) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  }

  const api = {
    computeChamferGeometry,
    generateProfileLoops,
    generatePocketLoops,
    generateDrillGCode,
    getPointsCenter
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.GcodedCAM = Object.assign(root.GcodedCAM || {}, { toolpaths: api });
  }
})(typeof window !== 'undefined' ? window : globalThis);
