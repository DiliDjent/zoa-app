<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '$lib/i18n';
  import RoadLight from '$lib/components/RoadLight.svelte';
  import LoadGauge from '$lib/components/LoadGauge.svelte';
  import ParkingCard from '$lib/components/ParkingCard.svelte';
  import CablecarCard from '$lib/components/CablecarCard.svelte';
  import WebcamGrid from '$lib/components/WebcamGrid.svelte';

  import { loadRoadStatus, type RoadStatus } from '$lib/adapters/traffic';
  import { parkingAdapter, type ParkingLot } from '$lib/adapters/parking';
  import { loadCablecarStatus, type CablecarStatus } from '$lib/adapters/cablecar';
  import type { SourceResult } from '$lib/adapters/types';
  import {
    computeLoadIndex,
    recordDailyValue,
    checkWarning,
    WARN_THRESHOLD,
    type LoadIndex
  } from '$lib/logic/load-index';

  let road = $state<SourceResult<RoadStatus> | null>(null);
  let parking = $state<SourceResult<ParkingLot[]> | null>(null);
  let cablecar = $state<SourceResult<CablecarStatus> | null>(null);
  let index = $state<LoadIndex | null>(null);
  let warning = $state<{ active: boolean; days: number }>({ active: false, days: 0 });
  let warningDismissed = $state(false);
  let loading = $state(true);

  async function loadAll() {
    loading = true;
    // Parallel laden: Faellt eine Quelle aus, zeigen die anderen trotzdem Werte.
    const [r, p, c] = await Promise.all([
      loadRoadStatus(),
      parkingAdapter.load(),
      loadCablecarStatus()
    ]);
    road = r;
    parking = p;
    cablecar = c;

    const computed = computeLoadIndex({ parking: p.data, road: r.data });
    index = computed;

    if (computed.value !== null) {
      const history = recordDailyValue(computed.value);
      warning = checkWarning(history);
    }
    loading = false;
  }

  onMount(() => {
    loadAll();
    // Beim Zurückkehren zur App neu laden - die Ampel muss aktuell sein.
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadAll();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  });
</script>

<svelte:head>
  <title>ZOA – Kastelruth in Zahlen</title>
</svelte:head>

<div class="space-y-4">
  {#if warning.active && !warningDismissed}
    <!-- Frühwarnung: erscheint erst nach mehreren Tagen über dem Schwellwert -->
    <div
      class="rounded-xl px-4 py-3 flex items-start gap-3"
      style="background: var(--color-status-red-soft); border: 1px solid var(--color-status-red);"
      role="alert"
    >
      <span class="text-lg leading-none mt-0.5" aria-hidden="true">▲</span>
      <div class="min-w-0 flex-1">
        <p class="font-bold text-[14px]">{$t('load.warningTitle')}</p>
        <p class="text-[13px] leading-snug mt-0.5">
          {$t('load.warningText', { days: warning.days, threshold: WARN_THRESHOLD })}
        </p>
      </div>
      <button
        class="tap px-2 text-[12px] font-semibold underline shrink-0"
        onclick={() => (warningDismissed = true)}
      >
        {$t('load.warningDismiss')}
      </button>
    </div>
  {/if}

  {#if loading && !road}
    <div class="card px-4 py-10 text-center muted text-sm">{$t('common.loading')}</div>
  {/if}

  {#if road}
    <RoadLight result={road} />
  {/if}

  {#if index}
    <LoadGauge {index} />
  {/if}

  {#if parking}
    <ParkingCard result={parking} />
  {/if}

  {#if cablecar}
    <CablecarCard result={cablecar} />
  {/if}

  <WebcamGrid />

  <p class="text-[11px] muted text-center px-4 pt-2 leading-snug">
    {$t('app.neutralityNote')}
  </p>
</div>
