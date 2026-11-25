import { PublicLayout } from '../layouts/PublicLayout';
import { PageHeader, PageHeaderVisual } from '../components/StatisticsCard';
import { EnvironmentalImpactCalculator } from '../components/impact/EnvironmentalImpactCalculator';
import { Icon } from '../components/ui/Icon';

export function CalculatorPage() {
  return (
    <PublicLayout>
      <PageHeader
        eyebrow="Kalkulator dampak lingkungan"
        title="Estimasi dampak ekologis dari kontribusi Anda."
        lead="Hitung perkiraan jumlah bibit, serapan CO₂, dan produksi O₂ dari nominal donasi tertentu, atau perkirakan kebutuhan dana untuk mencapai target serapan karbon. Seluruh asumsi perhitungan ditampilkan secara terbuka."
        aside={
          <PageHeaderVisual
            imageUrl="/images/site-agroforestry.jpg"
            alt="Lanskap agroforestri dan serapan karbon Loa Kulu"
            badge="Proyeksi 3 · 10 · 15 Tahun"
            caption="Model pertumbuhan logistik sigmoidal untuk estimasi CO₂ & O₂"
          />
        }
      />
      <section className="container calc-page">
        <EnvironmentalImpactCalculator />
        <div className="calc-page__notes">
          <div>
            <Icon name="sprout" size={20} />
            <h3>Kenapa tidak langsung rupiah → karbon?</h3>
            <p>Dana pertama-tama dikonversi menjadi bibit melalui biaya program, lalu bibit hidup dikonversi menjadi serapan melalui model pertumbuhan. Melompati langkah ini menyesatkan.</p>
          </div>
          <div>
            <Icon name="target" size={20} />
            <h3>Kenapa hasil tiap lokasi berbeda?</h3>
            <p>Biaya per bibit dan asumsi keberhasilan hidup berbeda antarprogram, misalnya lahan pascatambang yang butuh perbaikan media tanam.</p>
          </div>
          <div>
            <Icon name="refresh" size={20} />
            <h3>Rumus bisa diganti</h3>
            <p>Logika perhitungan terpisah dari tampilan. Parameter dapat diganti dengan persamaan alometrik per spesies atau metodologi lain tanpa mengubah desain.</p>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
