<script lang="ts">
  import { t } from '$lib/i18n';
  import type { LoadIndex } from '$lib/logic/load-index';

  let { index }: { index: LoadIndex } = $props();

  const value = $derived(index.value);

  const color = $derived.by(() => {
    if (value === null) return 'var(--color-status-neutral)';
    if (value < 40) return 'var(--color-status-green)';
    if (value < 75) return 'var(--color-status-amber)';
    return 'var(--color-status-red)';
  });

  // Halbkreis-Anzeige: Radius 80, Bogenlänge = π · r
  const ARC = Math.PI * 80;
  const dash = $derived(value === null ? 0 : (value / 100) * ARC);

  const factorPercent = (n: number) => Math.round(n * 100);
</script>

<section class="card px-4 py-4" aria-labelledby="load-heading">
  <h2 id="load-heading" class="text-[13px] font-bold uppercase tracking-wide muted">
    {$t('load.title')}
  </h2>
  <p class="text-[12px] muted mt-0.5">{$t('load.question')}</p>

  <div class="mt-3 flex flex-col items-center">
    <svg
      viewBox="0 0 200 108"
      class="w-full max-w-[280px]"
      role="img"
      aria-label={value === null
        ? $t('common.noData')
        : $t('a11y.loadGauge', { value })}
    >
      <path
        d="M 20 100 A 80 80 0 0 1 180 100"
        fill="none"
        stroke="var(--surface-sunken)"
        stroke-width="16"
        stroke-linecap="round"
      />
      {#if value !== null}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke={color}
          stroke-width="16"
          stroke-linecap="round"
          stroke-dasharray="{dash} {ARC}"
          style="transition: stroke-dasharray 700ms ease-out;"
        />
      {/if}
      <text
        x="100"
        y="88"
        text-anchor="middle"
        font-size="44"
        font-weight="800"
        fill="var(--ink)"
        style="font-variant-numeric: tabular-nums;"
      >
        {value ?? '–'}
      </text>
    </svg>

    <p class="text-lg font-bold -mt-1" style="color: {color};">{$t(index.levelKey)}</p>
    <p class="text-[11px] muted">{$t('load.scale')}</p>
  </div>

  <details class="mt-4 text-[13px]">
    <summary class="tap flex items-center cursor-pointer font-semibold select-none">
      {$t('load.howItWorks')}
    </summary>

    <p class="mt-2 leading-snug muted">{$t('load.explanation')}</p>

    <table class="mt-3 w-full text-[12px] border-collapse">
      <thead>
        <tr class="text-left muted">
          <th class="py-1 font-semibold">&nbsp;</th>
          <th class="py-1 font-semibold text-right">{$t('load.weight')}</th>
          <th class="py-1 font-semibold text-right">{$t('load.contribution')}</th>
        </tr>
      </thead>
      <tbody>
        {#each index.factors as f}
          <tr class="border-t" style="border-color: var(--line);">
            <td class="py-1.5 pr-2">
              {$t(f.labelKey)}
              {#if f.assumption}
                <span class="muted">·&nbsp;{$t('load.assumptionTag')}</span>
              {:else if f.forecast}
                <span class="muted">·&nbsp;{$t('load.forecastTag')}</span>
              {/if}
              {#if f.score === null}
                <span class="block muted">{$t('load.missingRedistributed')}</span>
              {:else if f.detail && (f.id === 'parking' || f.id === 'weather')}
                <span class="block muted tabular-nums">{f.detail}</span>
              {/if}
            </td>
            <td class="py-1.5 text-right tabular-nums whitespace-nowrap">
              {#if f.score === null}
                <span class="muted">{$t('load.missing')}</span>
              {:else}
                {factorPercent(f.effectiveWeight)}&thinsp;%
              {/if}
            </td>
            <td class="py-1.5 text-right tabular-nums font-semibold">
              {f.score === null ? '–' : Math.round(f.contribution)}
            </td>
          </tr>
        {/each}
      </tbody>
      <tfoot>
        <tr class="border-t-2" style="border-color: var(--line);">
          <td class="py-1.5 font-bold">{$t('load.title')}</td>
          <td></td>
          <td class="py-1.5 text-right font-extrabold tabular-nums">{value ?? '–'}</td>
        </tr>
      </tfoot>
    </table>

    <div
      class="mt-3 rounded-lg px-3 py-2 leading-snug"
      style="background: var(--surface-sunken);"
    >
      <p class="font-semibold text-[12px]">{$t('load.limitation')}</p>
      <p class="text-[12px] muted mt-0.5">{$t('load.limitationText')}</p>
    </div>
  </details>
</section>
