<footer class="ad-space-footer">
  <div class="billboard-container">
    <div class="billboard-frame">
      <div class="billboard-screen">
        <img src="/assets/sprites/ad_banner.png" alt="Espacio Publicitario" class="ad-banner-img" />
        <div class="ad-label-tag">ESPACIO PUBLICITARIO</div>
      </div>
    </div>
  </div>
</footer>

<style>
  .ad-space-footer {
    height: 82px;
    min-height: 72px;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #111116;
    border-radius: 0 0 10px 10px;
    padding: 6px 14px;
    box-sizing: border-box;
    border-top: 2px solid #27272e;
    z-index: 10;
  }

  .billboard-container {
    width: 100%;
    max-width: 680px;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .billboard-frame {
    width: 100%;
    height: 100%;
    background: #18181b;
    border: 2px solid #3f3f46;
    border-radius: 6px;
    padding: 3px;
    box-shadow: inset 0 2px 6px rgba(0,0,0,0.8), 0 4px 10px rgba(0,0,0,0.5);
  }

  .billboard-screen {
    width: 100%;
    height: 100%;
    position: relative;
    background: #ffffff;
    border-radius: 4px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .ad-banner-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    background: #ffffff;
  }

  .ad-label-tag {
    position: absolute;
    bottom: 2px;
    right: 4px;
    background: rgba(0, 0, 0, 0.75);
    color: #d4d4d8;
    font-size: 0.55rem;
    font-weight: 700;
    padding: 1px 4px;
    border-radius: 2px;
    letter-spacing: 0.5px;
  }

  @media (max-width: 768px) {
    .ad-space-footer { height: 64px; }
  }
</style>
