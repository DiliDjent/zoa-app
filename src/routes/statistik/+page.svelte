<script lang="ts">
  import { onMount } from 'svelte';
  import { t, fmtNumber } from '$lib/i18n';
  import DataFreshness from '$lib/components/DataFreshness.svelte';
  import VerlaufCard from '$lib/components/VerlaufCard.svelte';
  import { statisticsAdapter, ratios, type Statistics } from '$lib/adapters/statistics';
  import { verlaufAdapter, type Verlauf } from '$lib/adapters/verlauf';
  import type { SourceResult } from '$lib/adapters/types';

  let result = $state<SourceResult<Statistics> | null>(null);
  let verlauf = $state<SourceResult<Verlauf> | null>(null);
  let loading = $state(true);

  const stats = $derived(result?.data ?? null);
  const r = $derived(ratios(stats));

  /** Nächtigungen pro Tag - macht die Jahreszahl greifbar. */
  const staysPerDay = $derived(stats?.overnightStays ? stats.overnightStays / 365 : null);

  onMount(async () => {
    // Der Verlauf kommt aus der eigenen Auslieferung und ist schnell da; die
    // ASTAT-Abfrage dauert laenger. Beides parallel, damit nichts wartet.
    const [s, v] = await Promise.all([statisticsAdapter.load(), verlaufAdapter.load()]);
    result = s;
    verlauf = v;
    loading = false;
  });

  const yearLabel = $derived(
    stats?.referenceYear ? $t('stats.referenceYear', { year: stats.referenceYear }) : ''
  );
</script>

<svelte:head>
  <title>{$t('stats.title')} – ZOA</title>
</svelte:head>

<div class="space-y-4">
  <header class="px-1 pt-1">
    <h1 class="text-xl font-extrabold tracking-tight">{$t('stats.title')}</h1>
    <p class="text-[13px] muted mt-0.5">{$t('stats.subtitle')}</p>
  </header>

  {#if verlauf}
    <VerlaufCard result={verlauf} />
  {/if}

  {#if loading}
    <div class="card px-4 py-10 text-center muted text-sm">{$t('common.loading')}</div>
  {:else if !stats}
    <div class="card px-4 py-6">
      <p class="font-semibold text-sm">{$t('common.noData')}</p>
      <p class="text-[13px] muted mt-1">{$t('common.noDataHint')}</p>
      {#if result}<div class="mt-3"><DataFreshness {result} /></div>{/if}
    </div>
  {:else}
    <!-- Kernaussage zuerst: das Verhältnis, nicht die Rohzahl -->
    <section class="card px-4 py-4" aria-labelledby="ratio-heading">
      <h2 id="ratio-heading" class="text-[13px] font-bold uppercase tracking-wide muted">
        {$t('stats.ratioTitle')}
      </h2>

      <div class="mt-3 grid grid-cols-2 gap-3">
        <div class="rounded-xl px-3 py-3" style="background: var(--surface-sunken);">
          <p class="text-3xl font-extrabold tabular-nums leading-none">
            {r.bedsPerInhabitant ? $fmtNumber(r.bedsPerInhabitant, 2) : '–'}
          </p>
          <p class="text-[12px] muted mt-1 leading-snug">{$t('stats.bedsPerInhabitant')}</p>
        </div>
        <div class="rounded-xl px-3 py-3" style="background: var(--surface-sunken);">
          <p class="text-3xl font-extrabold tabular-nums leading-none">
            {r.staysPerInhabitant ? $fmtNumber(r.staysPerInhabitant, 0) : '–'}
          </p>
          <p class="text-[12px] muted mt-1 leading-snug">{$t('stats.staysPerInhabitant')}</p>
        </div>
      </div>

      {#if r.bedsPerInhabitant && r.staysPerInhabitant}
        <p class="mt-3 text-[13px] leading-snug">
          {$t('stats.ratioExplain', {
            beds: $fmtNumber(r.bedsPerInhabitant, 2),
            stays: $fmtNumber(r.staysPerInhabitant, 0)
          })}
        </p>
      {/if}
    </section>

    <section class="card px-4 py-4">
      <dl class="divide-y" style="--tw-divide-opacity: 1;">
        {#each [
          { k: 'stats.inhabitants', v: stats.inhabitants, d: 0 },
          { k: 'stats.beds', v: stats.beds, d: 0 },
          { k: 'stats.overnightStays', v: stats.overnightStays, d: 0 },
          { k: 'stats.arrivals', v: stats.arrivals, d: 0 },
          { k: 'stats.vehicles', v: stats.vehicles, d: 0 }
        ] as row}
          <div class="flex items-baseline justify-between gap-3 py-2.5 border-t first:border-t-0" style="border-color: var(--line);">
            <dt class="text-[14px]">{$t(row.k)}</dt>
            <dd class="text-[16px] font-bold tabular-nums">
              {row.v === null ? '–' : $fmtNumber(row.v, row.d)}
            </dd>
          </div>
        {/each}

        <div class="flex items-baseline justify-between gap-3 py-2.5 border-t" style="border-color: var(--line);">
          <dt class="text-[14px]">{$t('stats.bedOccupancy')}</dt>
          <dd class="text-[16px] font-bold tabular-nums">
            {stats.bedOccupancy === null ? '–' : `${$fmtNumber(stats.bedOccupancy, 1)} %`}
          </dd>
        </div>
      </dl>

      {#if yearLabel}
        <p class="mt-2 text-[11px] muted">{yearLabel}</p>
      {/if}
    </section>

    <!-- Saisonverteilung: zeigt, dass die Last nicht gleichmäßig anfällt -->
    {#if stats.summerStays && stats.winterStays && stats.overnightStays}
      {@const total = stats.summerStays + stats.winterStays}
      {@const summerPct = Math.round((stats.summerStays / total) * 100)}
      <section class="card px-4 py-4">
        <h2 class="text-[13px] font-bold uppercase tracking-wide muted">
          {$t('stats.overnightStays')}
        </h2>

        <div class="mt-3 flex h-8 rounded-lg overflow-hidden text-[11px] font-bold text-white">
          <div
            class="grid place-items-center"
            style="width: {summerPct}%; background: var(--color-status-amber);"
          >
            {summerPct}%
          </div>
          <div
            class="grid place-items-center"
            style="width: {100 - summerPct}%; background: var(--color-brand);"
          >
            {100 - summerPct}%
          </div>
        </div>
        <div class="mt-1.5 flex justify-between text-[12px] muted">
          <span>{$t('stats.summerStays')}: {$fmtNumber(stats.summerStays)}</span>
          <span>{$t('stats.winterStays')}: {$fmtNumber(stats.winterStays)}</span>
        </div>

        {#if staysPerDay}
          <p class="mt-3 text-[13px] leading-snug">
            {$fmtNumber(staysPerDay, 0)} {$t('stats.overnightStays').toLowerCase()}
            {$t('stats.perDay')}.
          </p>
        {/if}

        {#if stats.domesticStays && stats.foreignStays}
          <div class="mt-3 flex justify-between text-[12px] muted">
            <span>{$t('stats.domestic')}: {$fmtNumber(stats.domesticStays)}</span>
            <span>{$t('stats.foreign')}: {$fmtNumber(stats.foreignStays)}</span>
          </div>
        {/if}
      </section>
    {/if}

    <!-- Bewusst benannte Lücke statt stiller Auslassung -->
    <section class="card px-4 py-4">
      <h2 class="text-[13px] font-bold uppercase tracking-wide muted">
        {$t('stats.notPublished')}
      </h2>
      <p class="mt-2 text-[13px] leading-snug muted">{$t('stats.waterWasteNote')}</p>
    </section>

    {#if result}
      <div class="px-1"><DataFreshness {result} /></div>
    {/if}
  {/if}
</div>
