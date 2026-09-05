<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import { t, locale, setLocale, initLocale, LOCALES, coverage } from '$lib/i18n';

  let { children } = $props();

  let langOpen = $state(false);

  onMount(() => {
    initLocale();
  });

  const NAV = [
    { href: '/', key: 'nav.barometer', icon: 'gauge' },
    { href: '/statistik', key: 'nav.statistics', icon: 'chart' },
    { href: '/transparenz', key: 'nav.transparency', icon: 'doc', soon: true },
    { href: '/info', key: 'nav.info', icon: 'info' }
  ];

  const current = $derived($page.url.pathname.replace(base, '') || '/');
  const activeCoverage = $derived(coverage($locale));
</script>

<div class="min-h-full flex flex-col">
  <header
    class="sticky top-0 z-30 border-b backdrop-blur"
    style="border-color: var(--line); background: color-mix(in oklch, var(--surface) 88%, transparent);"
  >
    <div class="mx-auto max-w-2xl px-4 h-14 flex items-center justify-between gap-3">
      <a href="{base}/" class="flex items-center gap-2.5 tap -ml-1 px-1 rounded-lg">
        <img src="{base}/icons/icon.svg" alt="" class="w-8 h-8 rounded-lg" />
        <span class="leading-tight">
          <span class="block font-bold text-[15px] tracking-tight">{$t('app.name')}</span>
          <span class="block text-[11px] muted">{$t('app.tagline')}</span>
        </span>
      </a>

      <div class="relative">
        <button
          class="tap px-3 rounded-lg text-sm font-semibold border flex items-center gap-1.5"
          style="border-color: var(--line);"
          aria-expanded={langOpen}
          aria-haspopup="true"
          onclick={() => (langOpen = !langOpen)}
        >
          <span class="sr-only">{$t('common.language')}</span>
          <span aria-hidden="true">🌐</span>
          <span class="uppercase">{$locale}</span>
        </button>

        {#if langOpen}
          <!-- Klickfänger, damit das Menü überall wieder schließt -->
          <button
            class="fixed inset-0 z-10 cursor-default"
            aria-label={$t('common.close')}
            onclick={() => (langOpen = false)}
          ></button>
          <ul
            class="absolute right-0 mt-2 z-20 card py-1 min-w-[10rem] shadow-lg"
            style="box-shadow: 0 8px 30px rgb(0 0 0 / 0.18);"
          >
            {#each LOCALES as l}
              <li>
                <button
                  class="w-full tap px-3 text-left text-sm flex items-center justify-between gap-2 hover:opacity-70"
                  onclick={() => {
                    setLocale(l.code);
                    langOpen = false;
                  }}
                >
                  <span>{l.label}</span>
                  {#if $locale === l.code}<span aria-hidden="true">✓</span>{/if}
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>
  </header>

  {#if activeCoverage < 0.5}
    <!--
      Ehrlicher Hinweis statt stiller Rückfall: Wer Ladinisch wählt, soll
      wissen, warum die Oberfläche deutsch bleibt.
    -->
    <p
      class="mx-auto max-w-2xl w-full px-4 py-2 text-[12px] leading-snug"
      style="color: var(--ink-muted); background: var(--surface-sunken);"
    >
      Diese Sprache ist noch nicht übersetzt. Angezeigt wird Deutsch. Übersetzungen
      sind willkommen.
    </p>
  {/if}

  <main class="flex-1 mx-auto w-full max-w-2xl px-4 pb-28 pt-4">
    {@render children()}
  </main>

  <nav
    class="fixed bottom-0 inset-x-0 z-30 border-t backdrop-blur"
    style="border-color: var(--line); background: color-mix(in oklch, var(--surface) 92%, transparent); padding-bottom: env(safe-area-inset-bottom);"
    aria-label={$t('a11y.menu')}
  >
    <ul class="mx-auto max-w-2xl grid grid-cols-4">
      {#each NAV as item}
        {@const active = current === item.href}
        <li>
          <a
            href="{base}{item.href}"
            class="flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-[11px] font-semibold transition-colors"
            style={active ? 'color: var(--color-brand);' : 'color: var(--ink-muted);'}
            aria-current={active ? 'page' : undefined}
          >
            <span class="text-[19px] leading-none" aria-hidden="true">
              {#if item.icon === 'gauge'}◒{:else if item.icon === 'chart'}▤{:else if item.icon === 'doc'}▦{:else}◍{/if}
            </span>
            <span class="flex items-center gap-1">
              {$t(item.key)}
              {#if item.soon}
                <span
                  class="w-1.5 h-1.5 rounded-full inline-block"
                  style="background: var(--color-status-amber);"
                  title={$t('nav.comingSoon')}
                ></span>
              {/if}
            </span>
          </a>
        </li>
      {/each}
    </ul>
  </nav>
</div>
