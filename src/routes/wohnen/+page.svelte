<script lang="ts">
  import ComingSoon from '$lib/components/ComingSoon.svelte';
  import { t } from '$lib/i18n';
</script>

<svelte:head>
  <title>{$t('nav.housing')} – ZOA</title>
</svelte:head>

<ComingSoon titleKey="phase2.housingTitle" textKey="phase2.housingText" privacyKey="phase2.housingPrivacy" />
