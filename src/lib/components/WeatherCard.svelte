<script lang="ts">
  import { t, locale, fmtNumber } from '$lib/i18n';
  import DataFreshness from './DataFreshness.svelte';
  import type { SourceResult } from '$lib/adapters/types';
  import type { Weather, WeatherDay } from '$lib/adapters/weather';

  let { result }: { result: SourceResult<Weather> } = $props();
  const w = $derived(result.data);

  const todayLocal = $derived(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date())
  );

  function dayLabel(d: WeatherDay, i: number): string {
    if (d.date === todayLocal) return $t('weather.today');
    const tomorrow = new Date(new Date(todayLocal + 'T12:00:00Z').getTime() + 86400000)
      .toISOString()
      .slice(0, 10);
    if (d.date === tomorrow) return $t('weather.tomorrow');
    const tag = $locale === 'lld' ? 'it' : $locale;
    return new Intl.DateTimeFormat(tag, { weekday: 'short', day: 'numeric', month: 'numeric' }).format(
      new Date(d.date + 'T12:00:00Z')
    );
  }

  /** Piktogramm nach Wetterlage - Text bleibt daneben, das Symbol ist Beiwerk. */
  function glyph(key: string): string {
    switch (key) {
      case 'weather.q.sunny': return '☀';
      case 'weather.q.partlyCloudy': return '⛅';
      case 'weather.q.cloudy':
      case 'weather.q.veryCloudy':
      case 'weather.q.overcast': return '☁';
      case 'weather.q.rain': return '🌧';
      case 'weather.q.thunderstorm': return '⛈';
      case 'weather.q.snow': return '❄';
      case 'weather.q.fog': return '🌫';
      default: return '·';
    }
  }
</script>

<section class="card px-4 py-4" aria-labelledby="weather-heading">
  <h2 id="weather-heading" class="text-[13px] font-bold uppercase tracking-wide muted">
    {$t('weather.title')}
  </h2>
  <p class="text-[12px] muted mt-0.5">{$t('weather.subtitle')}</p>

  {#if w && w.days.length}
    {#if w.todayMissing}
      <p class="mt-2 text-[12px] muted">{$t('weather.todayMissing')}</p>
    {/if}

    <ul class="mt-3 grid gap-2" style="grid-template-columns: repeat({Math.min(4, w.days.length)}, minmax(0, 1fr));">
      {#each w.days as d, i}
        <li
          class="rounded-xl px-2 py-2.5 text-center"
          style="background: {i === 0 ? 'var(--color-brand-soft)' : 'var(--surface-sunken)'};"
        >
          <p class="text-[11px] font-bold uppercase tracking-wide muted">{dayLabel(d, i)}</p>
          <p class="text-2xl leading-none my-1.5" aria-hidden="true">{glyph(d.conditionKey)}</p>
          <p class="text-[11px] leading-tight min-h-[2.4em]">{$t(d.conditionKey)}</p>
          <p class="mt-1 text-[15px] font-bold tabular-nums">
            {d.tempMax === null ? '–' : `${$fmtNumber(d.tempMax)}°`}
            {#if d.tempMin !== null}
              <span class="font-medium muted text-[12px]">/ {$fmtNumber(d.tempMin)}°</span>
            {/if}
          </p>
          <p class="text-[11px] muted tabular-nums leading-tight mt-0.5">
            {#if d.precipitationMm !== null}{$fmtNumber(d.precipitationMm)} mm{/if}
            {#if d.sunshineHours !== null}
              <br />{$fmtNumber(d.sunshineHours)} h {$t('weather.sun')}
            {/if}
          </p>
        </li>
      {/each}
    </ul>

    <p class="mt-3 text-[11px] muted leading-snug">{$t('weather.forecastNote')}</p>
  {:else}
    <p class="mt-2 text-[13px] muted">{$t('common.noData')}</p>
  {/if}

  <div class="mt-2">
    <DataFreshness {result} />
  </div>
</section>
