(() => {

  const btnBody = document.getElementById("btnBody");
  const btnSkeleton = document.getElementById("btnSkeleton");
  const btnOrgans = document.getElementById("btnOrgans");
  const enterBtn = document.getElementById("enterBtn");
  const arButton = document.getElementById("arButton");

  const modelRoot = document.querySelector("#modelRoot");
  const layerBody = document.querySelector("#layer_body");
  const layerSkeleton = document.querySelector("#layer_skeleton");
  const layerOrgans = document.querySelector("#layer_organs");

  let placed = false;

  // Tombol Enter AR → Klik tombol AR bawaan
  enterBtn.addEventListener("click", () => {
    arButton.click();
  });

  // Setelah masuk AR, pengguna tap lantai → tempatkan model
  document.addEventListener("click", () => {
    if (placed) return;
    const reticle = document.querySelector("#reticle");
    if (!reticle.object3D.visible) return;
    modelRoot.setAttribute("visible", true);
    modelRoot.object3D.position.copy(reticle.object3D.position);
    placed = true;
  });

  // Layer Switching
  btnBody.addEventListener("click", () => {
    layerBody.setAttribute("visible", true);
    layerSkeleton.setAttribute("visible", false);
    layerOrgans.setAttribute("visible", false);
  });

  btnSkeleton.addEventListener("click", () => {
    layerBody.setAttribute("visible", false);
    layerSkeleton.setAttribute("visible", true);
    layerOrgans.setAttribute("visible", false);
  });

  btnOrgans.addEventListener("click", () => {
    layerBody.setAttribute("visible", false);
    layerSkeleton.setAttribute("visible", false);
    layerOrgans.setAttribute("visible", true);
  });

})();
