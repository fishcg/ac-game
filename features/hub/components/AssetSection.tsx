import { assetLibraries } from "@/config/assets";
import { ArrowIcon, BoxIcon } from "@/components/ui/Icons";

export function AssetSection() {
  return (
    <section className="asset-section" id="assets">
      <div className="asset-copy"><span className="section-kicker"><i /> CREATOR CORNER</span><h2>从免费素材，开始下一个世界</h2><p>已为后续游戏孵化预留素材登记规范。引入素材时同时记录作者、来源和许可证，避免版权风险。</p></div>
      <div className="asset-list">{assetLibraries.map((asset) => <a key={asset.name} href={asset.url} target="_blank" rel="noreferrer" className={`asset-link asset-link--${asset.tone}`}><span><BoxIcon /></span><span><strong>{asset.name}</strong><small>{asset.detail}</small></span><ArrowIcon /></a>)}</div>
    </section>
  );
}
