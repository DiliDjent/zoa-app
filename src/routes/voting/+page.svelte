<script lang="ts">
  import ComingSoon from '$lib/components/ComingSoon.svelte';
  import { t } from '$lib/i18n';
</script>

<svelte:head>
  <title>{$t('nav.voting')} – ZOA</title>
</svelte:head>

<ComingSoon titleKey="phase2.votingTitle" textKey="phase2.votingText" />
