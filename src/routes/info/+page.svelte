<script lang="ts">
  import { t } from '$lib/i18n';
  import { QUELLEN, GEMEINDE, ASTAT_BEZUGSJAHR } from '$lib/config/kastelruth';

  const SOURCES = [
    { q: QUELLEN.trafficBulletin, use: 'Sperrstatus der Seiser Alm-Straße, Verkehrsmeldungen' },
    { q: QUELLEN.odhMobility, use: 'Auslastung der Parkgaragen im Dorf' },
    { q: QUELLEN.odhTourism, use: 'Webcams, Gemeindestammdaten' },
    { q: QUELLEN.astat, use: `Nächtigungen, Betten, Bevölkerung, Fahrzeuge (${ASTAT_BEZUGSJAHR})` },
    { q: QUELLEN.lokal, use: 'Betriebszeiten der Umlaufbahn (gepflegter Fahrplan)' }
  ];
</script>

<svelte:head>
  <title>{$t('info.title')} – ZOA</title>
</svelte:head>

<div class="space-y-4">
  <header class="px-1 pt-1">
    <h1 class="text-xl font-extrabold tracking-tight">{$t('info.title')}</h1>
  </header>

  {#each [
    { t: 'info.whoTitle', b: 'info.whoText' },
    { t: 'info.whyTitle', b: 'info.whyText' },
    { t: 'info.dataTitle', b: 'info.dataText' },
    { t: 'info.privacyTitle', b: 'info.privacyText' }
  ] as block}
    <section class="card px-4 py-4">
      <h2 class="text-[15px] font-bold">{$t(block.t)}</h2>
      <p class="text-[14px] leading-relaxed mt-1.5">{$t(block.b)}</p>
    </section>
  {/each}

  <section class="card px-4 py-4">
    <h2 class="text-[15px] font-bold">{$t('info.sourcesTitle')}</h2>
    <ul class="mt-2 space-y-3">
      {#each SOURCES as s}
        <li class="border-t pt-3 first:border-t-0 first:pt-0" style="border-color: var(--line);">
          <a
            class="font-semibold text-[14px] underline decoration-dotted underline-offset-2"
            href={s.q.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {$t(s.q.labelKey)}
          </a>
          <p class="text-[12px] muted mt-0.5 leading-snug">{s.use}</p>
          {#if s.q.license}
            <p class="text-[11px] muted mt-0.5">Lizenz: {s.q.license}</p>
          {/if}
        </li>
      {/each}
    </ul>
  </section>

  <section class="card px-4 py-4">
    <h2 class="text-[15px] font-bold">{$t('info.licenseTitle')}</h2>
    <p class="text-[14px] leading-relaxed mt-1.5">{$t('info.licenseText')}</p>
    <p class="text-[12px] muted mt-2">
      {GEMEINDE.nameDe} / {GEMEINDE.nameIt} · ISTAT {GEMEINDE.istatCode}
    </p>
  </section>

  <p class="text-[12px] muted text-center px-4 leading-snug">{$t('app.neutralityNote')}</p>
</div>
