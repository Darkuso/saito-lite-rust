module.exports = DiscardOverlayTemplate = (app, mod, discard) => {

  let html = `
    <div class="saitoa settlers-info-overlay discard-cards-overlay">
      <div class="settlers-items-container settlers-items-container-3">
        <div class="settlers-item-row">
          <div class="settlers-item-info-text"> Select cards to discard (Must get rid 
          of ${discard.targetCt}): </div>
        </div>
  `;      

        for (let i in discard.my_resources) {
          if (discard.my_resources[i] > 0)
            html += `<div id="${i}" class="settlers-item-row settlers-cards-container">`;
            for (let j = 0; j < discard.my_resources[i]; j++){
              html += `<img id="${i}" src="${mod.returnCardImage(i)}">`;
            }
            html += `</div>`;
        }


  html += `
      </div>
    </div>
  `;

  return html;

}
