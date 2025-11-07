(() => {

  const btnBody = document.getElementById('btnBody');
  const btnSkeleton = document.getElementById('btnSkeleton');
  const btnOrgans = document.getElementById('btnOrgans');
  const toggleSkeletonSmall = document.getElementById('toggleSkeletonSmall');

  // A-Frame entities
  const scene = document.querySelector('a-scene');
  const reticle = document.getElementById('reticle');
  const modelRoot = document.getElementById('modelRoot');
  const layerBody = document.getElementById('layer_body');
  const layerSkeleton = document.getElementById('layer_skeleton');
  const layerOrgans = document.getElementById('layer_organs');

  // organ nodes for raycast (may be null if missing)
  const organNodes = [
    { id: 'heart', el: document.getElementById('organ_heart') },
    { id: 'lungs', el: document.getElementById('organ_lungs') },
    { id: 'brain', el: document.getElementById('organ_brain') }
  ];

  // state
  let placed = false;
  let organsMeta = [];

  // load organs metadata (optional)
  fetch('data/organs.json').then(r => r.json()).then(j => { organsMeta = j; }).catch(()=>{ organsMeta = []; });

  // helpers
  function showPlaceUI(show) { placeBtnWrap.style.display = show ? 'block' : 'none'; }
  function showControls(show) { controlsWrap.style.display = show ? 'flex' : 'none'; }

  // Initial UI state
  showPlaceUI(false);
  showControls(false);
  modelRoot.setAttribute('visible', false);

  // Layer switching
  function showLayer(layer) {
    layerBody && layerBody.setAttribute('visible', layer === 'body');
    layerSkeleton && layerSkeleton.setAttribute('visible', layer === 'skeleton');
    layerOrgans && layerOrgans.setAttribute('visible', layer === 'organs');
    if (placed) showControls(true);
  }
  btnBody && btnBody.addEventListener('click', () => showLayer('body'));
  btnSkeleton && btnSkeleton.addEventListener('click', () => showLayer('skeleton'));
  btnOrgans && btnOrgans.addEventListener('click', () => showLayer('organs'));
  toggleSkeletonSmall && toggleSkeletonSmall.addEventListener('click', () => {
    if (!layerSkeleton) return;
    const cur = layerSkeleton.getAttribute('visible');
    layerSkeleton.setAttribute('visible', !cur);
  });

  // Poll reticle visibility to show place button (since hit-test component toggles visibility)
  let reticlePoll = setInterval(() => {
    try {
      if (placed) {
        showPlaceUI(false);
        clearInterval(reticlePoll);
        return;
      }
      // If reticle exists and visible, show place button
      const visible = !!(reticle && reticle.object3D && reticle.object3D.visible);
      showPlaceUI(visible);
    } catch (e) {
      // ignore
    }
  }, 300);

  // Place model on button click (tap-to-place)
  placeModelBtn && placeModelBtn.addEventListener('click', () => {
    if (!reticle || !reticle.object3D) {
      alert('Reticle tidak tersedia. Arahkan kamera ke permukaan datar.');
      return;
    }
    if (!reticle.object3D.visible) {
      alert('Arahkan kamera ke permukaan sampai reticle muncul.');
      return;
    }

    // copy reticle pose to model root
    modelRoot.object3D.position.copy(reticle.object3D.position);
    modelRoot.object3D.quaternion.copy(reticle.object3D.quaternion);
    modelRoot.setAttribute('visible', true);

    // lock placement
    placed = true;
    showPlaceUI(false);
    showControls(true);

    // default to body layer
    showLayer('body');

    // hide reticle (optional)
    reticle.object3D.visible = false;
  });

  // Scale & rotate handlers
  scaleRange && scaleRange.addEventListener('input', (e) => {
    const s = parseFloat(e.target.value || 1);
    modelRoot.object3D.scale.set(s, s, s);
  });
  rotateRange && rotateRange.addEventListener('input', (e) => {
    const deg = parseFloat(e.target.value || 0);
    modelRoot.object3D.rotation.y = THREE.Math.degToRad(deg);
  });

  // Raycast for selection (works after placed)
  function onCanvasClick(ev) {
    if (!placed) return;
    // get normalized device coords
    const canvas = scene.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    const mouse = new THREE.Vector2(x, y);
    const camera = scene.camera;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    // collect meshes from visible layers
    const candidates = [];
    modelRoot.object3D.traverse(node => {
      if (!node.isMesh) return;
      // check if its ancestor layer is visible
      let p = node.parent;
      let ok = false;
      while (p) {
        if (p === layerOrgans && layerOrgans && layerOrgans.getAttribute('visible')) ok = true;
        if (p === layerBody && layerBody && layerBody.getAttribute('visible')) ok = true;
        if (p === layerSkeleton && layerSkeleton && layerSkeleton.getAttribute('visible')) ok = true;
        p = p.parent;
      }
      if (ok) candidates.push(node);
    });

    const intersects = raycaster.intersectObjects(candidates, true);
    if (intersects.length > 0) {
      const hit = intersects[0];
      const node = hit.object;
      const name = (node.name || (node.parent && node.parent.name) || '').toLowerCase();
      let organId = matchOrganName(name);

      // fallback: explicit organ nodes
      if (!organId) {
        for (let on of organNodes) {
          if (!on.el) continue;
          if (hit.object === on.el.object3D || hit.object.parent === on.el.object3D) {
            organId = on.id;
            break;
          }
        }
      }
      if (!organId) organId = 'body';
      showTooltip(ev.clientX, ev.clientY, organId);
    } else {
      hideTooltip();
    }
  }

  // wire canvas click
  try {
    const canvas = scene.renderer.domElement;
    canvas.addEventListener('click', onCanvasClick);
  } catch (e) {
    // renderer not ready yet — wait for scene loaded
    scene.addEventListener('renderstart', () => {
      const canvas = scene.renderer.domElement;
      canvas.addEventListener('click', onCanvasClick);
    }, { once: true });
  }

  function matchOrganName(name) {
    if (!name) return null;
    if (name.includes('heart') || name.includes('jantung')) return 'heart';
    if (name.includes('lung') || name.includes('paru')) return 'lungs';
    if (name.includes('brain') || name.includes('otak')) return 'brain';
    if (name.includes('skeleton') || name.includes('tulang')) return 'skeleton';
    if (name.includes('tusk') || name.includes('gading')) return 'tusk';
    if (name.includes('trunk') || name.includes('belalai')) return 'trunk';
    return null;
  }

  // Tooltip & detail
  function showTooltip(clientX, clientY, organId) {
    const meta = organsMeta.find(o => o.id === organId) || organsMeta.find(o => o.id === 'body') || { displayName: organId, shortDesc: '' };
    tooltip.style.display = 'block';
    tooltip.style.left = Math.min(window.innerWidth - 160, Math.max(10, clientX)) + 'px';
    tooltip.style.bottom = (window.innerHeight - clientY + 20) + 'px';
    tooltip.innerHTML = `<div style="font-weight:700;color:#173B2D;">${meta.displayName}</div><div style="margin-top:6px;">${meta.shortDesc}</div><div style="margin-top:8px;"><button id="moreBtn" class="btn">More</button></div>`;
    const moreBtn = document.getElementById('moreBtn');
    if (moreBtn) moreBtn.addEventListener('click', () => openDetail(meta));
  }
  function hideTooltip() {
    tooltip.style.display = 'none';
  }
  function openDetail(meta) {
    detailModal.style.display = 'block';
    detailModal.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;"><div style="font-weight:700;">${meta.displayName}</div><button id="closeDetail" class="btn-ghost">Close</button></div><div style="margin-top:8px;">${meta.longDesc || meta.shortDesc || ''}</div>`;
    const closeBtn = document.getElementById('closeDetail');
    if (closeBtn) closeBtn.addEventListener('click', () => { detailModal.style.display = 'none'; });
  }

  // cleanup on unload
  window.addEventListener('beforeunload', () => {
    // nothing special
  });

  // Safety: if renderer not ready, wait and then restore UI states
  if (!scene.renderer) {
    scene.addEventListener('renderstart', () => {
      // ensure reticle polling is active
      if (!placed) showPlaceUI(false);
    }, { once: true });
  }

})();
