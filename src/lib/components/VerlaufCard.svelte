<script lang="ts">
  import { base } from '$app/paths';
  import { t, locale, fmtNumber } from '$lib/i18n';
  import DataFreshness from './DataFreshness.svelte';
  import type { SourceResult } from '$lib/adapters/types';
  import type { Verlauf } from '$lib/adapters/verlauf';
  import { VERLAUF } from '$lib/config/kastelruth';
  import { WARN_THRESHOLD } from '$lib/logic/load-index';

  let { result }: { result: SourceResult<Verlauf> } = $props();
  const v = $derived(result.data);

  /** Die letzten N Tage, aufgefuellt mit Luecken, damit die Achse ehrlich bleibt. */
  const days = $derived.by(() => {
    if (!v || v.days.length === 0) return [];
    const byDate = new Map(v.days.map((d) => [d.date, d]));
    const last = v.days[v.days.length - 1].date;
    const out = [];
    for (let i = VERLAUF.anzeigeTage - 1; i >= 0; i--) {
      const d = new Date(new Date(last + 'T12:00:00Z').getTime() - i * 86400000)
        .toISOString()
        .slice(0, 10);
      out.push(byDate.get(d) ?? { date: d, samples: 0, maxIndex: null, closedShare: 0, peakRatio: null });
    }
    return out;
  });

  const closureDays = $derived(v ? v.days.filter((d) => d.closedShare > 0).length : 0);
  const peak = $derived(
    v ? Math.max(0, ...v.days.map((d) => d.peakRatio ?? 0)) : 0
  );

  function fmtDate(iso: string): string {
    const tag = $locale === 'lld' ? 'it' : $locale;
    return new Intl.DateTimeFormat(tag, { day: '2-digit', month: '2-digit' }).format(
      new Date(iso + 'T12:00:00Z')
    );
  }

  function barColor(value: number | null): string {
    if (value === null) return 'var(--line)';
    if (value < 40) return 'var(--color-status-green)';
    if (value < WARN_THRESHOLD) return 'var(--color-status-amber)';
    return 'var(--color-status-red)';
  }
</script>

<section class="card px-4 py-4" aria-labelledby="verlauf-heading">
  <h2 id="verlauf-heading" class="text-[13px] font-bold uppercase tracking-wide muted">
    {$t('verlauf.title')}
  </h2>
  <p class="text-[12px] muted mt-0.5">{$t('verlauf.subtitle')}</p>

  {#if !v || v.days.length === 0}
    <p class="mt-3 text-[13px] leading-snug muted">{$t('verlauf.none')}</p>
  {:else}
    <div class="mt-3 grid grid-cols-3 gap-2">
      <div class="rounded-xl px-2.5 py-2.5" style="background: var(--surface-sunken);">
        <p class="text-2xl font-extrabold tabular-nums leading-none">{v.days.length}</p>
        <p class="text-[11px] muted mt-1 leading-tight">
          {v.days.length === 1
            ? $t('verlauf.daysRecordedOne').replace(/^1\s*/, '')
            : $t('verlauf.daysRecorded', { n: '' }).trim()}
        </p>
      </div>
      <div class="rounded-xl px-2.5 py-2.5" style="background: var(--surface-sunken);">
        <p class="text-2xl font-extrabold tabular-nums leading-none">{closureDays}</p>
        <p class="text-[11px] muted mt-1 leading-tight">{$t('verlauf.closureDays')}</p>
      </div>
      <div class="rounded-xl px-2.5 py-2.5" style="background: var(--surface-sunken);">
        <p class="text-2xl font-extrabold tabular-nums leading-none">{$fmtNumber(peak * 100)}&thinsp;%</p>
        <p class="text-[11px] muted mt-1 leading-tight">{$t('verlauf.peakGarage')}</p>
      </div>
    </div>

    <p class="mt-4 text-[12px] font-semibold">{$t('verlauf.dailyIndex')}</p>
    <!--
      Balken je Tag. Luecken bleiben Luecken (grau, Hoehe 0): Ein Tag ohne
      Messung wird nicht mit dem Nachbarn aufgefuellt.
    -->
    <div
      class="mt-1.5 flex items-end gap-[2px] h-20"
      role="img"
      aria-label={$t('verlauf.dailyIndex')}
    >
      {#each days as d}
        <div
          class="flex-1 rounded-t-sm min-w-0"
          style="height: {d.maxIndex === null ? 2 : Math.max(3, d.maxIndex)}%; background: {barColor(d.maxIndex)};"
          title="{fmtDate(d.date)}: {d.maxIndex ?? '–'}"
        ></div>
      {/each}
    </div>
    <div class="mt-1 flex justify-between text-[10px] muted tabular-nums">
      <span>{fmtDate(days[0].date)}</span>
      <span style="border-top: 1px dashed var(--color-status-red); padding-top: 1px;">
        {WARN_THRESHOLD}
      </span>
      <span>{fmtDate(days[days.length - 1].date)}</span>
    </div>

    <p class="mt-3 text-[12px] muted leading-snug">{$t('verlauf.why')}</p>

    <p class="mt-2 text-[11px] muted">
      {v.totalSamples === 1
        ? $t('verlauf.samplesOne')
        : $t('verlauf.samples', { n: $fmtNumber(v.totalSamples) })}
      {#if v.firstSample}
        · {$t('verlauf.since', { date: fmtDate(v.firstSample.slice(0, 10)) })}
      {/if}
      ·
      <a
        class="underline decoration-dotted underline-offset-2"
        href="{base}{VERLAUF.pfad}"
        download="zoa-verlauf.csv"
      >
        {$t('verlauf.download')}
      </a>
    </p>
  {/if}

  <div class="mt-2">
    <DataFreshness {result} compact />
  </div>
</section>
