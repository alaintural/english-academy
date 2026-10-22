'use client';

import { useMemo, useState } from 'react';
import { Layers, Search } from 'lucide-react';
import { useStore } from '@/lib/store';
import { isDue } from '@/lib/srs';
import { getVocabulary } from '@/lib/content';
import { useData } from '@/lib/useData';
import type { UserWord } from '@/lib/types';
import { Segmented } from '@/components/ReaderSettings';
import { Button, Card, Empty, ProgressBar, Screen, Sheet, SpeakButton } from '@/components/ui';

const TARGET = 800;

export default function WordsPage() {
  const { words, setWordStatus, removeWord } = useStore();
  const { data: bank } = useData(getVocabulary, []);
  const [tab, setTab] = useState<'learning' | 'known'>('learning');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<UserWord | null>(null);

  const all = Object.values(words);
  const due = all.filter((w) => isDue(w)).length;
  const known = all.filter((w) => w.status === 'known').length;
  const list = useMemo(
    () =>
      all
        .filter((w) => w.status === tab && (!q || `${w.lemma} ${w.meaning_tr}`.toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr'))))
        .sort((a, b) => (tab === 'learning' ? a.box - b.box || b.wrong - a.wrong : a.lemma.localeCompare(b.lemma))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [words, tab, q],
  );

  return (
    <Screen title="Kelimelerim" subtitle="Kişisel sözlüğün ve tekrar çalışmaların">
      <Card className="mb-4">
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary"><Layers size={28} /></div>
          <div className="flex-1">
            <p className="text-[22px] font-bold tabular-nums">{due} <span className="text-[15px] font-medium text-muted">kelime tekrar bekliyor</span></p>
            <p className="text-[13px] text-muted">{all.length} kayıtlı · {known} biliyorum</p>
          </div>
        </div>
        <Button block className="mt-4" href="/kelimelerim/tekrar/" variant={due ? 'primary' : 'secondary'}>
          {due ? 'Tekrara başla' : all.length ? 'Serbest tekrar yap' : 'Kelime ekleyince tekrar başlar'}
        </Button>
        <div className="mt-4 flex justify-between text-[13px] text-muted">
          <span>A1 hedefi: {TARGET} kelime</span>
          <span className="tabular-nums">{known}/{TARGET}</span>
        </div>
        <ProgressBar value={(known / TARGET) * 100} className="mt-1.5 h-1.5" color="bg-success" />
        {bank && <p className="mt-2 text-[12px] text-muted">Platformdaki kelime bankası şu an {bank.length} kelime içeriyor.</p>}
      </Card>

      <Segmented value={tab} onChange={setTab} options={[{ v: 'learning', l: `Öğreniyorum (${all.length - known})` }, { v: 'known', l: `Biliyorum (${known})` }]} />
      <label className="relative mt-3 block">
        <Search size={18} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" aria-hidden />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Kelime ara"
          className="h-11 w-full rounded-xl bg-surface-2 pr-3 pl-10 outline-none placeholder:text-muted" />
      </label>

      {!all.length ? (
        <Empty icon={<Layers size={30} />} title="Henüz kelime yok">
          Okurken bir kelimeye dokunup <b>Kelimelerime ekle</b>&apos;ye bas ya da derslerdeki kelimeleri kaydet.
        </Empty>
      ) : (
        <Card className="mt-3 mb-6 p-0">
          <ul className="divide-y divide-line">
            {list.map((w) => (
              <li key={w.lemma}>
                <div className="flex items-center gap-2 py-1.5 pr-2 pl-4">
                  <button type="button" onClick={() => setOpen(w)} className="min-h-[52px] min-w-0 flex-1 text-left">
                    <p className="truncate text-[17px] font-semibold">{w.lemma}</p>
                    <p className="truncate text-[14px] text-muted">{w.meaning_tr}</p>
                  </button>
                  <BoxDots box={w.box} />
                  <SpeakButton text={w.lemma} />
                </div>
              </li>
            ))}
            {!list.length && <li className="p-6 text-center text-muted">Bu listede kelime yok.</li>}
          </ul>
        </Card>
      )}

      <Sheet open={!!open} onClose={() => setOpen(null)}>
        {open && (
          <div>
            <div className="flex items-center gap-3">
              <p className="flex-1 font-serif text-[30px] font-bold">{open.lemma}</p>
              <SpeakButton text={open.lemma} className="h-12 w-12" />
            </div>
            <p className="text-[20px] font-semibold text-primary">{open.meaning_tr}</p>
            {open.example_en && (
              <div className="mt-4 rounded-2xl bg-surface-2 p-4">
                <div className="flex items-start gap-2">
                  <p className="flex-1 font-serif text-[17px]">{open.example_en}</p>
                  <SpeakButton text={open.example_en} />
                </div>
                <p className="mt-1 text-[15px] text-muted">{open.example_tr}</p>
              </div>
            )}
            <p className="mt-3 text-[13px] text-muted">
              {open.source_label && <>Kaynak: {open.source_label} · </>}Kutu {open.box}/5 · ✓ {open.correct} · ✗ {open.wrong}
            </p>
            <div className="mt-5 grid gap-2">
              <Button block variant="secondary" onClick={() => { setWordStatus(open.lemma, open.status === 'known' ? 'learning' : 'known'); setOpen(null); }}>
                {open.status === 'known' ? 'Tekrar öğrenmeye al' : 'Biliyorum olarak işaretle'}
              </Button>
              <Button block variant="ghost" className="text-danger" onClick={() => { removeWord(open.lemma); setOpen(null); }}>Listeden sil</Button>
            </div>
          </div>
        )}
      </Sheet>
    </Screen>
  );
}

function BoxDots({ box }: { box: number }) {
  return (
    <span className="flex gap-0.5" aria-label={`Kutu ${box}/5`}>
      {[1, 2, 3, 4, 5].map((i) => <span key={i} className={`h-1.5 w-1.5 rounded-full ${i <= box ? 'bg-success' : 'bg-line'}`} />)}
    </span>
  );
}
