<script lang="ts">
  import ComingSoon from '$lib/components/ComingSoon.svelte';
  import { t } from '$lib/i18n';
</script>

<svelte:head>
  <title>{$t('nav.report')} – ZOA</title>
</svelte:head>

<ComingSoon titleKey="phase2.reportTitle" textKey="phase2.reportText" privacyKey="phase2.reportPrivacy" />
