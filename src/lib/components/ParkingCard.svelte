<script lang="ts">
  import { t, locale, fmtNumber } from '$lib/i18n';
  import DataFreshness from './DataFreshness.svelte';
  import type { SourceResult } from '$lib/adapters/types';
  import type { ParkingLot } from '$lib/adapters/parking';
  import { COMPATSCH } from '$lib/config/kastelruth';

  let { result }: { result: SourceResult<ParkingLot[]> } = $props();

  const lots = $derived(result.data ?? []);

  function barColor(ratio: number | null): string {
    if (ratio === null) return 'var(--color-status-neutral)';
    if (ratio >= 0.95) return 'var(--color-status-red)';
    if (ratio >= 0.8) return 'var(--color-status-amber)';
    return 'var(--color-status-green)';
  }

  function name(lot: ParkingLot): string {
    return $locale === 'it' ? lot.nameIt : lot.nameDe;
  }
</script>

<section class="card" aria-labelledby="parking-heading">
  <div class="px-4 pt-4 pb-2">
    <h2 id="parking-heading" class="text-[13px] font-bold uppercase tracking-wide muted">
      {$t('parking.title')}
    </h2>
    <p class="text-[12px] muted mt-0.5">{$t('parking.subtitle')}</p>
  </div>

  <ul class="px-4 pb-2 space-y-4">
    {#each lots as lot}
      <li>
        <div class="flex items-baseline justify-between gap-3">
          <span class="font-semibold text-[15px] leading-tight">{name(lot)}</span>
          {#if lot.free !== null}
            <span class="text-[15px] font-bold tabular-nums whitespace-nowrap">
              {$fmtNumber(lot.free)}
              <span class="font-medium muted text-[13px]">{$t('common.free')}</span>
            </span>
          {:else}
            <span class="text-[13px] muted">{$t('common.noData')}</span>
          {/if}
        </div>

        <div
          class="mt-1.5 h-3 rounded-full overflow-hidden"
          style="background: var(--surface-sunken);"
          role="img"
          aria-label="{$fmtNumber(lot.occupied ?? 0)} {$t('common.occupied')} {$t('parking.spotsOf', { total: lot.capacity })}"
        >
          {#if lot.ratio !== null}
            <div
              class="h-full rounded-full transition-[width] duration-500"
              style="width: {Math.round(lot.ratio * 100)}%; background: {barColor(lot.ratio)};"
            ></div>
          {/if}
        </div>

        <div class="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] muted">
          <span>
            {$fmtNumber(lot.occupied ?? 0)} {$t('common.occupied')}
            {$t('parking.spotsOf', { total: lot.capacity })}
          </span>
          {#if lot.forecast.length}
            <span aria-hidden="true">·</span>
            <span>
              {$t('parking.forecast')}:
              {#each lot.forecast as f, i}{i > 0 ? ', ' : ''}{$t('parking.forecastIn', {
                  minutes: f.inMinutes
                })} {$fmtNumber(f.occupied)}{/each}
            </span>
          {/if}
        </div>

        {#if lot.note}
          <!--
            Sichtbarer Hinweis statt stiller Korrektur: Wenn ein Zählwerk
            unplausible Werte liefert, muss der Leser das wissen.
          -->
          <p
            class="mt-1.5 text-[11px] leading-snug rounded px-2 py-1"
            style="background: var(--color-status-amber-soft);"
          >
            {$t(lot.note)}
          </p>
        {/if}
      </li>
    {/each}

    <!-- Compatsch: bewusst als Lücke ausgewiesen, nicht geschätzt -->
    <li class="pt-1 border-t" style="border-color: var(--line);">
      <div class="flex items-baseline justify-between gap-3 pt-3">
        <span class="font-semibold text-[15px] leading-tight">{$t('parking.compatschTitle')}</span>
        <span class="text-[13px] muted whitespace-nowrap">{$t('parking.compatschCapacity')}</span>
      </div>
      <div
        class="mt-1.5 h-3 rounded-full"
        style="background: repeating-linear-gradient(135deg, var(--surface-sunken) 0 6px, transparent 6px 12px); border: 1px dashed var(--line);"
        aria-hidden="true"
      ></div>
      <p class="mt-1.5 text-[11px] leading-snug muted">
        {$t('parking.compatschNoLive')}
        <br />{$t('parking.compatschRequested')}
      </p>
    </li>
  </ul>

  <div class="px-4 pb-4">
    <DataFreshness {result} />
  </div>
</section>
