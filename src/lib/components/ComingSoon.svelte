<script lang="ts">
  import { t } from '$lib/i18n';

  let {
    titleKey,
    textKey,
    privacyKey = null
  }: { titleKey: string; textKey: string; privacyKey?: string | null } = $props();
</script>

<div class="space-y-4">
  <header class="px-1 pt-1">
    <div class="flex items-center gap-2">
      <h1 class="text-xl font-extrabold tracking-tight">{$t(titleKey)}</h1>
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
    <p class="text-[14px] leading-relaxed">{$t(textKey)}</p>

    {#if privacyKey}
      <p
        class="mt-3 text-[13px] leading-snug rounded-lg px-3 py-2"
        style="background: var(--surface-sunken);"
      >
        <strong>{$t(privacyKey)}</strong>
      </p>
    {/if}
  </section>

  <p class="text-[12px] muted text-center px-4">{$t('phase2.notify')}</p>
</div>
