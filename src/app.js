// src/app.js
(() => {
  // UI elements
  const enterBtn = document.getElementById('enterBtn');
  const placeModelBtn = document.getElementById('placeModel');
  const placeBtnWrap = document.getElementById('placeBtn');
  const controlsWrap = document.getElementById('controls');
  const scaleRange = document.getElementById('scaleRange');
  const rotateRange = document.getElementById('rotateRange');
  const tooltip = document.getElementById('tooltip');
  const detailModal = document.getElementById('detailModal');

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

  // organ nodes for raycast
  const organNodes = [
    { id: 'heart', el: document.getElementById('organ_heart') },
    { id: 'lungs', el: document.getElementById('organ_lungs') },
    { id: 'brain', el: document.getElementById('organ_brain') }
  ];

  // state
  let xrSession = null;
  let xrRefSpace = null;
  let viewerRef = null;
  let hitTestSource = null;
  let placed = false;
  let anchorPose = null;
  let organsMeta = [];

  // load organs metadata
  fetch('data/organs.json').then(r => r.json()).then(j => { organsMeta = j; }).catch(_=>{ organsMeta = []; });

  // show/hide helpers
  function showPlaceUI(show){
    placeBtnWrap.style.display = show ? 'block' : 'none';
  }
  function showControls(show){
    controlsWrap.style.display = show ? 'flex' : 'none';
  }

  // Layer switching
  function showLayer(layer){
    // accepted: 'body' | 'skeleton' | 'organs'
    layerBody.setAttribute('visible', layer === 'body');
    layerSkeleton.setAttribute('visible', layer === 'skeleton');
    layerOrgans.setAttribute('visible', layer === 'organs');
    // auto show controls only after placement
    if (placed) showControls(true);
  }

  btnBody.addEventListener('click', () => showLayer('body'));
  btnSkeleton.addEventListener('click', () => showLayer('skeleton'));
  btnOrgans.addEventListener('click', () => showLayer('organs'));
  toggleSkeletonSmall.addEventListener('click', () => {
    const cur = layerSkeleton.getAttribute('visible');
    layerSkeleton.setAttribute('visible', !cur);
  });

  // Enter AR
  enterBtn.addEventListener('click', async () => {
    if (!navigator.xr) return alert('WebXR tidak tersedia di browser ini.');
    try {
      xrSession = await navigator.xr.requestSession('immersive-ar', { requiredFeatures: ['hit-test','local-floor'] });
      scene.renderer.xr.setSession(xrSession);
      xrRefSpace = await xrSession.requestReferenceSpace('local-floor');
      viewerRef = await xrSession.requestReferenceSpace('viewer');
      hitTestSource = await xrSession.requestHitTestSource({ space: viewerRef });

      enterBtn.style.display = 'none';
      showPlaceUI(true);

      xrSession.requestAnimationFrame(onXRFrame);
      xrSession.addEventListener('end', () => {
        xrSession = null;
        enterBtn.style.display = 'block';
        showPlaceUI(false);
        showControls(false);
        modelRoot.setAttribute('visible', false);
        placed = false;
      });
    } catch (e) {
      console.error(e);
      alert('Gagal memulai sesi AR: ' + e.message);
    }
  });

  function onXRFrame(time, frame){
    const session = frame.session;
    session.requestAnimationFrame(onXRFrame);
    if (!hitTestSource) return;
    const pose = frame.getViewerPose(xrRefSpace);
    if (!pose) return;

    const results = frame.getHitTestResults(hitTestSource);
    if (results.length > 0 && !placed) {
      const hit = results[0];
      const p = hit.getPose(xrRefSpace);
      reticle.object3D.visible = true;
      reticle.object3D.position.set(p.transform.position.x, p.transform.position.y, p.transform.position.z);
      reticle.object3D.quaternion.set(p.transform.orientation.x, p.transform.orientation.y, p.transform.orientation.z, p.transform.orientation.w);
    } else {
      if (!placed) reticle.object3D.visible = false;
    }

    // lock model to anchorPose (simple stored pose)
    if (placed && anchorPose) {
      const p = anchorPose.transform.position;
      const o = anchorPose.transform.orientation;
      modelRoot.object3D.position.set(p.x, p.y, p.z);
      modelRoot.object3D.quaternion.set(o.x, o.y, o.z, o.w);
    }
  }

  // Place model
  placeModelBtn.addEventListener('click', () => {
    if (!reticle.object3D.visible) return alert('Permukaan belum terdeteksi. Gerakkan perangkat pelan-pelan.');
    anchorPose = {
      transform: {
        position: {
          x: reticle.object3D.position.x,
          y: reticle.object3D.position.y,
          z: reticle.object3D.position.z
        },
        orientation: {
          x: reticle.object3D.quaternion.x,
          y: reticle.object3D.quaternion.y,
          z: reticle.object3D.quaternion.z,
          w: reticle.object3D.quaternion.w
        }
      }
    };
    modelRoot.object3D.position.copy(reticle.object3D.position);
    modelRoot.object3D.quaternion.copy(reticle.object3D.quaternion);
    modelRoot.setAttribute('visible', true);
    reticle.object3D.visible = false;
    placed = true;
    showPlaceUI(false);
    showControls(true);

    // default show body layer
    showLayer('body');
  });

  // Scale & rotate
  scaleRange.addEventListener('input', (e) => {
    const s = parseFloat(e.target.value);
    modelRoot.object3D.scale.set(s, s, s);
  });
  rotateRange.addEventListener('input', (e) => {
    const deg = parseFloat(e.target.value);
    modelRoot.object3D.rotation.y = THREE.Math.degToRad(deg);
  });

  // Raycast for organ selection (click/tap)
  const canvas = scene.renderer.domElement;
  canvas.addEventListener('click', onCanvasClick);

  function onCanvasClick(ev){
    if (!placed) return;
    // if organs layer not visible, ignore unless body/skeleton have internal colliders
    const rect = canvas.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    const mouse = new THREE.Vector2(x,y);
    const camera = scene.camera;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    // collect meshes from visible layer(s)
    const candidates = [];
    modelRoot.object3D.traverse(node => {
      if (!node.isMesh) return;
      // ensure the node belongs to a visible layer (walk up parents)
      let parent = node.parent;
      let ok = false;
      while(parent){
        if (parent === layerOrgans && layerOrgans.getAttribute('visible')) ok = true;
        if (parent === layerBody && layerBody.getAttribute('visible')) ok = true;
        if (parent === layerSkeleton && layerSkeleton.getAttribute('visible')) ok = true;
        parent = parent.parent;
      }
      if (ok) candidates.push(node);
    });

    const intersects = raycaster.intersectObjects(candidates, true);
    if (intersects.length > 0) {
      const hit = intersects[0];
      const node = hit.object;
      // try match organ by name first
      const name = (node.name || (node.parent && node.parent.name) || '').toLowerCase();
      let organId = matchOrganName(name);
      // Fallback: check our explicit organNodes by comparing object3D === el.object3D or bounding box proximity
      if (!organId) {
        for (let on of organNodes){
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

  function matchOrganName(name){
    if (!name) return null;
    if (name.includes('heart') || name.includes('jantung')) return 'heart';
    if (name.includes('lung') || name.includes('paru')) return 'lungs';
    if (name.includes('brain') || name.includes('otak')) return 'brain';
    if (name.includes('skeleton') || name.includes('tulang')) return 'skeleton';
    if (name.includes('tusk') || name.includes('gading')) return 'tusk';
    if (name.includes('trunk') || name.includes('belalai')) return 'trunk';
    return null;
  }

  function showTooltip(clientX, clientY, organId){
    const meta = organsMeta.find(o => o.id === organId) || organsMeta.find(o => o.id === 'body') || { displayName: organId, shortDesc: '' };
    tooltip.style.display = 'block';
    // place tooltip with small offset to avoid finger occlusion
    tooltip.style.left = Math.min(window.innerWidth - 160, Math.max(20, clientX)) + 'px';
    tooltip.style.bottom = (window.innerHeight - clientY + 20) + 'px';
    tooltip.innerHTML = `<div class="title">${meta.displayName}</div><div class="small">${meta.shortDesc}</div><div style="margin-top:8px;"><button id="moreBtn" class="btn">More</button></div>`;
    const moreBtn = document.getElementById('moreBtn');
    moreBtn.addEventListener('click', () => openDetail(meta));
  }

  function hideTooltip(){
    tooltip.style.display = 'none';
  }

  function openDetail(meta){
    detailModal.style.display = 'block';
    detailModal.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;"><div class="title">${meta.displayName}</div><button id="closeDetail" class="btn-ghost">Close</button></div><div style="margin-top:8px;" class="small">${meta.longDesc || meta.shortDesc || ''}</div>`;
    document.getElementById('closeDetail').addEventListener('click', () => { detailModal.style.display = 'none'; });
  }

  // cleanup
  window.addEventListener('beforeunload', () => {
    if (xrSession) xrSession.end();
  });

});
