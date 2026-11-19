/**
 * Gcoded CAM - Módulo de Geometria 2D (Inspirado na arquitetura Cut-Craft)
 * Funções puras de polígonos, desfasamento ClipperLib, sentido de corte (Climb/Conventional),
 * rasterização de cavidades, Dogbone/T-Bone, Rampas e Abas de Retenção (Tabs).
 */
(function (root) {
  'use strict';

  /**
   * Calcula a área com sinal de um polígono (Shoelace Formula).
   * > 0: Anti-horário (CCW) | < 0: Horário (CW)
   */
  function signedArea(pts) {
    if (!pts || pts.length < 3) return 0;
    let a = 0;
    const len = pts.length;
    for (let i = 0; i < len - 1; i++) {
      a += (pts[i].x * pts[i + 1].y) - (pts[i + 1].x * pts[i].y);
    }
    // Se não estiver fechado explicitamente, fecha o último segmento
    if (Math.hypot(pts[0].x - pts[len - 1].x, pts[0].y - pts[len - 1].y) > 1e-4) {
      a += (pts[len - 1].x * pts[0].y) - (pts[0].x * pts[len - 1].y);
    }
    return a / 2;
  }

  /**
   * Verifica se uma polilinha é fechada (ponto inicial coincide com o final).
   */
  function isClosedLoop(pts, tol = 0.1) {
    if (!pts || pts.length < 3) return false;
    return Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < tol;
  }

  /**
   * Garante o sentido de fresagem correto (Concordante / Climb vs Discordante / Conventional).
   * Num router CNC com fuso horário (M3 CW):
   *  - Corte Exterior: Climb = Horário (CW, area < 0) | Conventional = Anti-horário (CCW, area > 0)
   *  - Corte Interior / Pocket: Climb = Anti-horário (CCW, area > 0) | Conventional = Horário (CW, area < 0)
   */
  function ensureWinding(points, cutDirection = 'climb', strategy = 'outside') {
    if (!points || points.length < 3 || !isClosedLoop(points)) return points;
    const area = signedArea(points);
    if (Math.abs(area) < 1e-6) return points;

    const isCCW = area > 0;
    const isInner = (strategy === 'inside' || strategy === 'pocket');
    const wantCCW = isInner ? (cutDirection === 'climb') : (cutDirection !== 'climb');

    if (isCCW !== wantCCW) {
      return points.slice().reverse();
    }
    return points;
  }

  /**
   * Calcula de forma garantidamente segura e finita as passagens em Z.
   * Suporta startDepth (profundidade inicial abaixo de Z=0, ex: fundo de uma cavidade já aberta).
   */
  function calculateSafeZPasses(rawDepthPass, rawTargetDepth, rawStartDepth = 0) {
    const parsedPass = parseFloat(rawDepthPass);
    const stepZ = Math.max(0.05, Math.abs(!isNaN(parsedPass) && parsedPass !== 0 ? parsedPass : 1.0));

    const parsedStart = parseFloat(rawStartDepth);
    const startZ = -Math.abs(!isNaN(parsedStart) ? parsedStart : 0);

    const parsedTarget = parseFloat(rawTargetDepth);
    let targetZ = -Math.abs(!isNaN(parsedTarget) && parsedTarget !== 0 ? parsedTarget : 0.1);
    if (targetZ >= startZ) {
      targetZ = startZ - 0.1;
    }

    const zPasses = [];
    let currentZ = startZ - stepZ;
    let guard = 0;

    while (currentZ > targetZ + 1e-5 && guard++ < 500) {
      zPasses.push(Number(currentZ.toFixed(4)));
      currentZ -= stepZ;
    }
    zPasses.push(Number(targetZ.toFixed(4)));

    return zPasses;
  }

  /**
   * Desfasamento Geométrico 2D de Alta Precisão (ClipperLib / Vatti Polygon Offsetting).
   * delta > 0: Exterior (alarga) | delta < 0: Interior (encolhe)
   * Devolve [] se o polígono colapsar completamente (evita loops infinitos em pockets).
   */
  function offsetContour(points, delta, joinType = 'round') {
    if (!points || points.length < 3) return [];
    if (Math.abs(delta) < 1e-4) return [points];

    const clipper = (typeof window !== 'undefined' && window.ClipperLib)
      ? window.ClipperLib
      : (typeof ClipperLib !== 'undefined' ? ClipperLib : null);

    if (clipper && clipper.ClipperOffset) {
      try {
        const scale = 1000;
        const closed = isClosedLoop(points, 0.1);
        const loop = closed ? points.slice(0, -1) : points.slice();

        const clipperPath = loop.map(p => ({
          X: Math.round(p.x * scale),
          Y: Math.round(p.y * scale)
        }));

        clipper.Clipper.CleanPolygon(clipperPath, 0.05 * scale);
        const area = clipper.Clipper.Area(clipperPath);
        if (area < 0) {
          clipperPath.reverse();
        }

        const co = new clipper.ClipperOffset(2.0, 0.025 * scale);
        const jt = joinType === 'miter' ? clipper.JoinType.jtMiter :
                   joinType === 'square' ? clipper.JoinType.jtSquare : clipper.JoinType.jtRound;

        co.AddPath(clipperPath, jt, clipper.EndType.etClosedPolygon);
        const solution = new clipper.Paths();
        co.Execute(solution, delta * scale);

        const results = [];
        for (let i = 0; i < solution.length; i++) {
          const poly = solution[i].map(pt => ({
            x: pt.X / scale,
            y: pt.Y / scale
          }));
          if (poly.length >= 3) {
            poly.push({ ...poly[0] });
            results.push(poly);
          }
        }
        return results;
      } catch (err) {
        console.warn("[Gcoded CAM] ClipperOffset falhou, a usar fallback geométrico:", err);
      }
    }

    // Fallback Geométrico com Limite Rigoroso de Miter
    const closed = isClosedLoop(points, 1e-3);
    const loop = closed ? points.slice(0, -1) : points.slice();
    const n = loop.length;
    if (n < 3) return [points];

    const area = signedArea(points);
    const dSign = area >= 0 ? delta : -delta;

    // Verificar colapso aproximado por bounding box quando encolhe
    if (delta < 0) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of loop) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      if ((maxX - minX) <= Math.abs(delta) * 2.02 || (maxY - minY) <= Math.abs(delta) * 2.02) {
        return [];
      }
    }

    const normals = [];
    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n;
      const dx = loop[next].x - loop[i].x;
      const dy = loop[next].y - loop[i].y;
      const len = Math.hypot(dx, dy) || 1;
      normals.push({ x: dy / len, y: -dx / len });
    }

    const offsetLoop = [];
    const miterLimit = 1.414;

    for (let i = 0; i < n; i++) {
      const prev = (i - 1 + n) % n;
      const n1 = normals[prev];
      const n2 = normals[i];

      const bx = n1.x + n2.x;
      const by = n1.y + n2.y;
      const blen = Math.hypot(bx, by);

      if (blen < 1e-6) {
        offsetLoop.push({ x: loop[i].x + n2.x * dSign, y: loop[i].y + n2.y * dSign });
        continue;
      }

      const ubx = bx / blen;
      const uby = by / blen;
      const cosHalf = n1.x * ubx + n1.y * uby;

      if (Math.abs(cosHalf) < 0.2) {
        offsetLoop.push({ x: loop[i].x + n2.x * dSign, y: loop[i].y + n2.y * dSign });
        continue;
      }

      let miterDist = dSign / cosHalf;
      if (Math.abs(miterDist / dSign) > miterLimit) {
        miterDist = Math.sign(miterDist) * Math.abs(dSign) * miterLimit;
      }

      offsetLoop.push({
        x: loop[i].x + ubx * miterDist,
        y: loop[i].y + uby * miterDist
      });
    }

    if (closed) {
      offsetLoop.push({ ...offsetLoop[0] });
    }
    return [offsetLoop];
  }

  /**
   * Gera linhas de rasterização (scanlines em zig-zag) recortadas ao interior de um polígono fechado.
   * Inspirado no Pocket Raster do Cut-Craft.
   */
  function generateRasterLines(polygon, stepMM, angleDeg = 0) {
    if (!polygon || polygon.length < 3) return [];
    const safeStep = Math.max(0.2, stepMM || 1.0);
    const rad = (angleDeg || 0) * Math.PI / 180;
    const cosA = Math.cos(-rad);
    const sinA = Math.sin(-rad);
    const cosB = Math.cos(rad);
    const sinB = Math.sin(rad);

    // Rodar polígono para espaço horizontal de scanline
    const rotPts = polygon.map(p => ({
      x: p.x * cosA - p.y * sinA,
      y: p.x * sinA + p.y * cosA
    }));

    let minY = Infinity, maxY = -Infinity;
    for (const p of rotPts) {
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const segments = [];
    const n = rotPts.length;
    let forward = true;
    let guard = 0;

    for (let y = minY + safeStep * 0.5; y < maxY - 1e-4 && guard++ < 500; y += safeStep) {
      const xs = [];
      for (let i = 0; i < n - 1; i++) {
        const p1 = rotPts[i];
        const p2 = rotPts[i + 1];
        if ((p1.y <= y && p2.y > y) || (p2.y <= y && p1.y > y)) {
          const t = (y - p1.y) / (p2.y - p1.y);
          xs.push(p1.x + t * (p2.x - p1.x));
        }
      }
      xs.sort((a, b) => a - b);

      const rowSegs = [];
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const x1 = xs[k];
        const x2 = xs[k + 1];
        if (x2 - x1 > 0.15) {
          const aPt = { x: x1 * cosB - y * sinB, y: x1 * sinB + y * cosB };
          const bPt = { x: x2 * cosB - y * sinB, y: x2 * sinB + y * cosB };
          rowSegs.push(forward ? [aPt, bPt] : [bPt, aPt]);
        }
      }
      if (!forward) rowSegs.reverse();
      rowSegs.forEach(s => segments.push(s));
      forward = !forward;
    }

    return segments;
  }

  /**
   * Alívios de cantos interiores (Dogbone / T-Bone) para encaixes macho-fêmea.
   */
  function applyDogboneRelief(points, toolRadius, type = 'dogbone', strategy = 'inside') {
    if (!points || points.length < 3 || toolRadius <= 0.05) return points;
    if (!isClosedLoop(points, 0.1)) return points;

    const loop = points.slice(0, -1);
    const n = loop.length;
    if (n < 3) return points;

    const area = signedArea(points);
    const isCCW = area > 0;
    const newPoints = [];

    for (let i = 0; i < n; i++) {
      const pPrev = loop[(i - 1 + n) % n];
      const pCurr = loop[i];
      const pNext = loop[(i + 1) % n];

      newPoints.push({ x: pCurr.x, y: pCurr.y });

      const vInX = pCurr.x - pPrev.x;
      const vInY = pCurr.y - pPrev.y;
      const lenIn = Math.hypot(vInX, vInY);

      const vOutX = pNext.x - pCurr.x;
      const vOutY = pNext.y - pCurr.y;
      const lenOut = Math.hypot(vOutX, vOutY);

      if (lenIn < 0.5 || lenOut < 0.5) continue;

      const uInX = vInX / lenIn;
      const uInY = vInY / lenIn;
      const uOutX = vOutX / lenOut;
      const uOutY = vOutY / lenOut;

      const cross = uInX * uOutY - uInY * uOutX;
      const dot = Math.max(-1, Math.min(1, uInX * uOutX + uInY * uOutY));
      const turnAngle = Math.acos(dot);

      const isLeftTurn = cross > 0;
      const isInternalCorner = (strategy === 'inside' || strategy === 'pocket')
        ? (isCCW ? isLeftTurn : !isLeftTurn)
        : (isCCW ? !isLeftTurn : isLeftTurn);

      if (isInternalCorner && turnAngle > 0.35 && turnAngle < 2.8) {
        const theta = Math.PI - turnAngle;
        const sinHalf = Math.sin(theta / 2);
        if (sinHalf < 0.15) continue;

        let reliefDist = toolRadius * (1 / sinHalf - 1);
        reliefDist = Math.min(reliefDist, toolRadius * 1.15);
        if (reliefDist < 0.05) continue;

        const d1X = -uInX, d1Y = -uInY;
        const d2X = uOutX, d2Y = uOutY;

        let bx = -(d1X + d2X);
        let by = -(d1Y + d2Y);
        const bLen = Math.hypot(bx, by);
        if (bLen < 1e-5) continue;
        bx /= bLen;
        by /= bLen;

        if (type === 'tbone-h') {
          bx = bx >= 0 ? 1 : -1;
          by = 0;
          reliefDist = toolRadius;
        } else if (type === 'tbone-v') {
          bx = 0;
          by = by >= 0 ? 1 : -1;
          reliefDist = toolRadius;
        }

        newPoints.push({ x: pCurr.x + bx * reliefDist, y: pCurr.y + by * reliefDist });
        newPoints.push({ x: pCurr.x, y: pCurr.y });
      }
    }

    if (newPoints.length > 0) {
      newPoints.push({ x: newPoints[0].x, y: newPoints[0].y });
    }
    return newPoints;
  }

  /**
   * Entrada em Rampa (Ramping) ao longo do contorno para proteger a ponta da fresa.
   */
  function generateRampedPass(loop, zStart, zTarget, rampAngleDeg = 10, maxRampLen = 30) {
    if (!loop || loop.length < 2) return loop.map(p => ({ ...p, z: zTarget }));

    const dz = Math.abs(zStart - zTarget);
    if (dz < 0.01) return loop.map(p => ({ ...p, z: zTarget }));

    const rad = Math.max(1, Math.min(45, rampAngleDeg)) * Math.PI / 180;
    let requiredRampLen = dz / Math.tan(rad);
    if (maxRampLen > 0) requiredRampLen = Math.min(requiredRampLen, maxRampLen);

    let totalLen = 0;
    const segLengths = [];
    for (let i = 0; i < loop.length - 1; i++) {
      const l = Math.hypot(loop[i + 1].x - loop[i].x, loop[i + 1].y - loop[i].y);
      segLengths.push(l);
      totalLen += l;
    }

    if (totalLen < 0.1) return loop.map(p => ({ ...p, z: zTarget }));
    const actualRampLen = Math.min(requiredRampLen, totalLen * 0.9);
    const waypoints = [{ x: loop[0].x, y: loop[0].y, z: zStart }];

    let distAccum = 0;
    let rampFinished = false;
    const extraCleanSegments = [];

    for (let i = 0; i < loop.length - 1; i++) {
      const p1 = loop[i];
      const p2 = loop[i + 1];
      const segLen = segLengths[i];
      if (segLen < 1e-5) continue;

      if (!rampFinished) {
        if (distAccum + segLen < actualRampLen) {
          distAccum += segLen;
          const progress = distAccum / actualRampLen;
          const zVal = zStart - dz * progress;
          waypoints.push({ x: p2.x, y: p2.y, z: zVal });
          extraCleanSegments.push({ x: p2.x, y: p2.y, z: zTarget });
        } else {
          const rem = actualRampLen - distAccum;
          const t = rem / segLen;
          const midX = p1.x + (p2.x - p1.x) * t;
          const midY = p1.y + (p2.y - p1.y) * t;
          waypoints.push({ x: midX, y: midY, z: zTarget });
          extraCleanSegments.push({ x: midX, y: midY, z: zTarget });

          if (t < 0.999) {
            waypoints.push({ x: p2.x, y: p2.y, z: zTarget });
          }
          rampFinished = true;
        }
      } else {
        waypoints.push({ x: p2.x, y: p2.y, z: zTarget });
      }
    }

    extraCleanSegments.forEach(pt => waypoints.push(pt));
    return waypoints;
  }

  /**
   * Abas de Retenção (Tabs / Pontes) nas passagens de fundo de um contorno.
   */
  function generateContourWithTabs(points, tabOptions, zVal, depthTotal) {
    if (!tabOptions || !tabOptions.enabled || tabOptions.count <= 0) {
      return points.map(p => ({ x: p.x, y: p.y, z: zVal }));
    }

    const tabZ = depthTotal + tabOptions.height;
    if (zVal >= tabZ) {
      return points.map(p => ({ x: p.x, y: p.y, z: zVal }));
    }

    let totalLen = 0;
    const segLengths = [];
    for (let i = 0; i < points.length - 1; i++) {
      const len = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
      segLengths.push(len);
      totalLen += len;
    }

    if (totalLen < tabOptions.width * 1.5) {
      return points.map(p => ({ x: p.x, y: p.y, z: zVal }));
    }

    const tabCenters = [];
    const spacing = totalLen / tabOptions.count;
    for (let k = 0; k < tabOptions.count; k++) {
      tabCenters.push(spacing * (k + 0.5));
    }

    const halfW = tabOptions.width / 2;
    const tabIntervals = tabCenters.map(c => ({
      start: Math.max(0.1, c - halfW),
      end: Math.min(totalLen - 0.1, c + halfW)
    }));

    const waypoints = [{ x: points[0].x, y: points[0].y, z: zVal }];
    let currentDist = 0;

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const segLen = segLengths[i];
      const segEnd = currentDist + segLen;

      if (segLen < 1e-4) continue;

      const events = [];
      tabIntervals.forEach(tab => {
        if (tab.start > currentDist && tab.start < segEnd) {
          events.push({ dist: tab.start, type: 'enter' });
        }
        if (tab.end > currentDist && tab.end < segEnd) {
          events.push({ dist: tab.end, type: 'exit' });
        }
      });
      events.sort((a, b) => a.dist - b.dist);

      const isInsideTabAt = (d) => tabIntervals.some(tab => d >= tab.start && d <= tab.end);

      for (const ev of events) {
        const t = (ev.dist - currentDist) / segLen;
        const ix = p1.x + (p2.x - p1.x) * t;
        const iy = p1.y + (p2.y - p1.y) * t;
        if (ev.type === 'enter') {
          waypoints.push({ x: ix, y: iy, z: zVal });
          waypoints.push({ x: ix, y: iy, z: tabZ });
        } else if (ev.type === 'exit') {
          waypoints.push({ x: ix, y: iy, z: tabZ });
          waypoints.push({ x: ix, y: iy, z: zVal });
        }
      }

      const endInTab = isInsideTabAt(segEnd);
      waypoints.push({ x: p2.x, y: p2.y, z: endInTab ? tabZ : zVal });
      currentDist = segEnd;
    }

    return waypoints;
  }

  const api = {
    signedArea,
    isClosedLoop,
    ensureWinding,
    calculateSafeZPasses,
    offsetContour,
    generateRasterLines,
    applyDogboneRelief,
    generateRampedPass,
    generateContourWithTabs
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.GcodedCAM = Object.assign(root.GcodedCAM || {}, { geometry: api });
  }
})(typeof window !== 'undefined' ? window : globalThis);
