
module.exports = ArcadeMainTemplate = (app, mod) => {
  return `
    <div id="saito-container" class="saito-container arcade-container">
      <div class="saito-sidebar-left"></div>
      <div id="arcade-main" class="arcade-main">
        <div id="arcade-banner" class="arcade-banner"></div>
        <div id="arcade-invites" class="arcade-invites">
          <div id="arcade-tab-buttons" class="arcade-tab-buttons">
            <div id="tab-button-arcade" class="tab-button">Games Invites</div>
            <div id="tab-button-observer-live" class="tab-button">Live Games</div>
            <div id="tab-button-observer-review" class="tab-button">Recent Games</div>
          </div>
          <div id="arcade-tabs" class="arcade-tabs">
            <div id="arcade-hero" class="arcade-hero arcade-tab-hidden"></div>
            <div id="observer-live-hero" class="arcade-hero arcade-tab-hidden"></div>
            <div id="observer-review-hero" class="arcade-hero arcade-tab-hidden"></div>
          </div>
        </div>
        <div id="arcade-leagues" class="arcade-leagues"></div>
      </div>
    </div>
  `;
}
