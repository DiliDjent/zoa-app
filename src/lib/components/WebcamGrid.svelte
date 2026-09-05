<script lang="ts">
  import { t, locale, fmtTime } from '$lib/i18n';
  import { WEBCAMS } from '$lib/config/kastelruth';

  /**
   * Webcams werden direkt als Bild eingebunden, mit Cache-Buster.
   * Bewusst kein Auto-Refresh im Hintergrund: Die Bilder sind mehrere hundert
   * Kilobyte gross, und die App soll im Mobilfunknetz nicht ungefragt Daten
   * verbrauchen. Aktualisiert wird auf Tastendruck.
   */
  let stamp = $state(Date.now());
  let failed = $state<Record<string, boolean>>({});
  let open = $state<string | null>(null);

  function refresh() {
    stamp = Date.now();
    failed = {};
  }

  function src(url: string): string {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}_=${stamp}`;
  }

  function name(cam: { nameDe: string; nameIt: string }): string {
    return $locale === 'it' ? cam.nameIt : cam.nameDe;
  }
</script>

<section class="card px-4 py-4" aria-labelledby="webcam-heading">
  <div class="flex items-start justify-between gap-3">
    <div>
      <h2 id="webcam-heading" class="text-[13px] font-bold uppercase tracking-wide muted">
        {$t('webcam.title')}
      </h2>
      <p class="text-[12px] muted mt-0.5">{$t('webcam.subtitle')}</p>
    </div>
    <button
      class="tap px-3 rounded-lg border text-[13px] font-semibold shrink-0"
      style="border-color: var(--line);"
      onclick={refresh}
    >
      {$t('webcam.refresh')}
    </button>
  </div>

  <!--
    Volle Breite statt zweispaltigem Raster: Die Kameras liefern Panoramen
    mit Seitenverhältnissen bis 3,7:1. In einer schmalen Kachel bliebe davon
    nur ein Ausschnitt der Bildmitte übrig - genau der Teil, der für die Frage
    "wie voll ist es" am wenigsten aussagt.
  -->
  <ul class="mt-3 space-y-3">
    {#each WEBCAMS as cam}
      <li>
        <button
          class="w-full text-left"
          onclick={() => (open = open === cam.id ? null : cam.id)}
          aria-label="{name(cam)} – {$t('webcam.openFull')}"
        >
          <div
            class="rounded-lg overflow-hidden grid place-items-center min-h-[72px]"
            style="background: var(--surface-sunken);"
          >
            {#if failed[cam.id]}
              <span class="text-[11px] muted px-2 py-6 text-center">{$t('webcam.loadError')}</span>
            {:else}
              <img
                src={src(cam.url)}
                alt={name(cam)}
                loading="lazy"
                decoding="async"
                class="w-full h-auto max-h-56 object-cover"
                onerror={() => (failed = { ...failed, [cam.id]: true })}
              />
            {/if}
          </div>
          <div class="mt-1 flex items-baseline justify-between gap-2">
            <span class="text-[13px] font-semibold leading-tight">{name(cam)}</span>
            <span class="text-[10px] muted shrink-0">{cam.attribution}</span>
          </div>
        </button>
      </li>
    {/each}
  </ul>

  <p class="mt-2 text-[11px] muted">{$t('webcam.imageAge', { time: $fmtTime(new Date(stamp)) })}</p>
</section>

{#if open}
  {@const cam = WEBCAMS.find((c) => c.id === open)}
  {#if cam}
    <div
      class="fixed inset-0 z-50 grid place-items-center p-4"
      style="background: rgb(0 0 0 / 0.85);"
      role="dialog"
      aria-modal="true"
      aria-label={name(cam)}
    >
      <button
        class="absolute inset-0 cursor-zoom-out"
        aria-label={$t('common.close')}
        onclick={() => (open = null)}
      ></button>
      <figure class="relative max-w-full max-h-full">
        <img src={src(cam.url)} alt={name(cam)} class="max-w-full max-h-[80vh] rounded-lg" />
        <figcaption class="mt-2 text-center text-white text-sm font-semibold">
          {name(cam)}
          <span class="block text-[11px] opacity-70">{cam.attribution}</span>
        </figcaption>
      </figure>
      <button
        class="absolute top-4 right-4 tap px-4 rounded-lg bg-white/90 text-black font-semibold text-sm"
        onclick={() => (open = null)}
      >
        {$t('common.close')}
      </button>
    </div>
  {/if}
{/if}
