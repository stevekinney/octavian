<script lang="ts">
	import '@lostgradient/cinder/styles';
	import { onMount } from 'svelte';
	import NavigationBar from '@lostgradient/cinder/navigation-bar';
	import NavigationItem from '@lostgradient/cinder/navigation-item';
	import Button from '@lostgradient/cinder/button';
	import Menu from 'lucide-svelte/icons/menu';
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';

	let { children } = $props();
	let mobileMenuOpen = $state(false);
	let mounted = $state(false);
	onMount(() => {
		mounted = true;
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Vibratone — Ear-training flash cards</title>
</svelte:head>

<NavigationBar
	class="site-navigation"
	label="Primary navigation"
	bind:mobileMenuOpen
	menuTogglePlacement="before-brand"
>
	{#snippet menuToggle(attrs)}
		<Button iconOnly aria-label="Navigation menu" {...attrs} disabled={!mounted}>
			<Menu size={20} aria-hidden="true" />
		</Button>
	{/snippet}
	{#snippet items({ variant })}
		<NavigationItem href="/ear-training" {variant} active={page.url.pathname === '/ear-training'}>
			Ear training
		</NavigationItem>
		<NavigationItem
			href="/key-signatures"
			{variant}
			active={page.url.pathname === '/key-signatures'}
		>
			Key signatures
		</NavigationItem>
		<NavigationItem href="/fretboard" {variant} active={page.url.pathname === '/fretboard'}
			>Fretboard</NavigationItem
		>
		<NavigationItem href="/chords" {variant} active={page.url.pathname === '/chords'}
			>Chords</NavigationItem
		>
		<NavigationItem
			href="/chord-training"
			{variant}
			active={page.url.pathname === '/chord-training'}>Chord training</NavigationItem
		>
	{/snippet}
</NavigationBar>

{@render children()}
