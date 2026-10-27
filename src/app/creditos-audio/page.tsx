import Link from "next/link";
export default function AudioCreditsPage() {
  return <main className="mx-auto max-w-3xl px-6 py-12 text-sm leading-relaxed">
    <Link href="/alumno" className="text-brand">← Verbo NEXT</Link>
    <h1 className="mt-7 text-3xl font-semibold tracking-tight">Créditos de audio</h1>
    <p className="mt-5">Los guiones de los simuladores TOEFL 2 y 3 y del simulador DET 2026 son originales de Verbo NEXT. Sus audios se generaron localmente con selección de voces y montaje de diálogos.</p>
    <ul className="mt-6 list-disc space-y-4 pl-5">
      <li>Motor <a className="text-brand underline" href="https://github.com/rhasspy/piper/releases/tag/2023.11.14-2">Piper 2023.11.14-2</a>, de Michael Hansen y colaboradores, bajo licencia MIT.</li>
      <li>Voces estadounidenses: modelo Piper LibriTTS-R medium, basado en el corpus <a className="text-brand underline" href="https://www.openslr.org/141/">LibriTTS-R</a>, de Yuma Koizumi, Heiga Zen, Shigeki Karita, Yifan Ding, Kohei Yatabe, Nobuyuki Morioka, Michiel Bacchiani, Yu Zhang, Wei Han y Ankur Bapna (2023), bajo licencia CC BY 4.0.</li>
      <li>Voces británicas: modelo Piper VCTK medium, basado en <a className="text-brand underline" href="https://datashare.ed.ac.uk/handle/10283/3443">CSTR VCTK</a>, de Junichi Yamagishi, Christophe Veaux y Kirsten MacDonald, bajo licencia CC BY 4.0.</li>
    </ul>
    <p className="mt-6">Las grabaciones son síntesis nuevas de nuestros guiones; los autores de los corpus y sus participantes no grabaron estos textos. No se implica su respaldo a la plataforma.</p>
    <p className="mt-4"><a className="text-brand underline" href="https://creativecommons.org/licenses/by/4.0/">Licencia CC BY 4.0</a> · <a className="text-brand underline" href="/audio/toefl-2026/voices-forms-2-3.json">Detalle de voces por archivo</a></p>
    <p className="mt-4"><a href="/audio/det-2026/manifest.json" className="text-brand underline">Audios de DET</a></p>
    <h2 className="mt-8 text-xl font-semibold">Fotografías de DET</h2>
    <p className="mt-3">Fotografías bajo <a className="text-brand underline" href="https://unsplash.com/license">licencia Unsplash</a>, reducidas para su presentación en el examen. Sus autores no respaldan esta plataforma.</p>
    <ul className="mt-4 list-disc space-y-2 pl-5">
      <li><a className="text-brand underline" href="https://unsplash.com/photos/a-person-selling-fruits-at-an-outdoor-market-52gZQu4zwrM">Mercado — Karel Mistrík</a></li>
      <li><a className="text-brand underline" href="https://unsplash.com/photos/two-people-studying-in-a-quiet-sunlit-space-z_dLp6KnCoQ">Estudio — Caroline Andrade Rocha</a></li>
      <li><a className="text-brand underline" href="https://unsplash.com/photos/a-person-fixing-a-bicycle-JcYh9G4sJPs">Bicicleta — Anton Savinov</a></li>
      <li><a className="text-brand underline" href="https://unsplash.com/photos/people-walking-on-park-during-daytime-eSQNlt0QmXI">Parque — Kelly Sikkema</a></li>
    </ul>
  </main>;
}
