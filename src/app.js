(() => {

  const btnBody = document.getElementById("btnBody");
  const btnSkeleton = document.getElementById("btnSkeleton");
  const btnOrgans = document.getElementById("btnOrgans");

  const layerBody = document.querySelector("#layer_body");
  const layerSkeleton = document.querySelector("#layer_skeleton");
  const layerOrgans = document.querySelector("#layer_organs");

  // Tidak ada placement. Model muncul otomatis di atas marker.

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
