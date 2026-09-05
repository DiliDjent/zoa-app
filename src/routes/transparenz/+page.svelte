<script lang="ts">
  import { t } from '$lib/i18n';
  import { base } from '$app/paths';

  /**
   * Übersicht über die geplanten Bereiche der zweiten Ausbaustufe.
   * Bewusst als Sammelseite, damit die Bereiche auffindbar sind, ohne die
   * untere Navigation zu überladen.
   */
  const AREAS = [
    { href: '/transparenz', titleKey: 'phase2.transparencyTitle', textKey: 'phase2.transparencyText', self: true },
    { href: '/voting', titleKey: 'phase2.votingTitle', textKey: 'phase2.votingText' },
    { href: '/melden', titleKey: 'phase2.reportTitle', textKey: 'phase2.reportText' },
    { href: '/wohnen', titleKey: 'phase2.housingTitle', textKey: 'phase2.housingText' }
  ];
</script>

<svelte:head>
  <title>{$t('nav.transparency')} – ZOA</title>
</svelte:head>

<div class="space-y-4">
  <header class="px-1 pt-1">
    <div class="flex items-center gap-2 flex-wrap">
      <h1 class="text-xl font-extrabold tracking-tight">{$t('phase2.title')}</h1>
      <span
        class="text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
        style="background: var(--color-status-amber-soft);"
      >
        {$t('nav.comingSoon')}
      </span>
    </div>
    <p class="text-[13px] muted mt-1">{$t('phase2.intro')}</p>
  </header>

  <section class="card px-4 py-4">
    <h2 class="text-[15px] font-bold">{$t('phase2.transparencyTitle')}</h2>
    <p class="text-[14px] leading-relaxed mt-1.5">{$t('phase2.transparencyText')}</p>
  </section>

  <ul class="space-y-2.5">
    {#each AREAS.filter((a) => !a.self) as area}
      <li>
        <a
          href="{base}{area.href}"
          class="card px-4 py-3.5 flex items-center gap-3 tap"
        >
          <span class="min-w-0 flex-1">
            <span class="block font-bold text-[15px]">{$t(area.titleKey)}</span>
            <span class="block text-[12px] muted leading-snug mt-0.5 line-clamp-2">
              {$t(area.textKey)}
            </span>
          </span>
          <span class="muted text-lg shrink-0" aria-hidden="true">›</span>
        </a>
      </li>
    {/each}
  </ul>

  <p class="text-[12px] muted text-center px-4">{$t('phase2.notify')}</p>
</div>
