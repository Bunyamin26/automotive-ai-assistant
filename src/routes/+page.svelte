<script>
	import { enhance } from '$app/forms';
	import { browser } from '$app/environment';

	let { form } = $props();

	// ---------------------------------------------------------------------------
	// Grundlæggende formular-state
	// ---------------------------------------------------------------------------
	let problem = $state('');
	let plate = $state('');
	let isLoading = $state(false);
	let isListening = $state(false);
	let recognition = $state(null);
	let speechSupported = $state(false);

	// ---------------------------------------------------------------------------
	// Multi-turn samtale-state
	// ---------------------------------------------------------------------------
	let conversation = $state('[]');
	let clarifyMode = $state(false);
	let clarifyQuestions = $state([]);
	let clarifyMessage = $state('');
	let clarifyAnswers = $state({});
	let originalProblem = $state('');
	let hasOriginalProblem = $state(false);

	// ---------------------------------------------------------------------------
	// Medie-upload state (billede + video analyseres af Gemini AI)
	// ---------------------------------------------------------------------------
	let uploadedImage = $state(null);
	let uploadedVideo = $state(null);
	let imageName = $state('');
	let videoName = $state('');
	let imageFileInput = $state(null);
	let videoFileInput = $state(null);

	// ---------------------------------------------------------------------------
	// Reagér på serversvar — opdatér samtale-state ud fra AI's svartype
	// ---------------------------------------------------------------------------
	$effect(() => {
		if (!form?.success || !form?.aiData) return;

		conversation = form.conversation ?? '[]';

		if (form.aiData.mode === 'clarify') {
			if (!hasOriginalProblem) {
				originalProblem = form.problem ?? '';
				hasOriginalProblem = true;
			}
			clarifyMode = true;
			clarifyQuestions = form.aiData.questions ?? [];
			clarifyMessage = form.aiData.message ?? '';
			clarifyAnswers = {};
			// Ryd medie efter første indsendelse — det er allerede analyseret
			uploadedImage = null;
			uploadedVideo = null;
			imageName = '';
			videoName = '';
		} else if (form.aiData.mode === 'diagnose') {
			clarifyMode = false;
			clarifyQuestions = [];
			problem = '';
			uploadedImage = null;
			uploadedVideo = null;
			imageName = '';
			videoName = '';
		}
	});

	// ---------------------------------------------------------------------------
	// Web Speech API — initialiseres én gang i browser-miljøet
	// ---------------------------------------------------------------------------
	$effect(() => {
		if (!browser) return;
		const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
		if (!SR) return;
		speechSupported = true;
		const rec = new SR();
		rec.lang = 'da-DK';
		rec.continuous = false;
		rec.interimResults = false;
		rec.onresult = (e) => {
			problem = e.results[0][0].transcript;
			isListening = false;
		};
		rec.onerror = () => {
			isListening = false;
		};
		rec.onend = () => {
			isListening = false;
		};
		recognition = rec;
	});

	// ---------------------------------------------------------------------------
	// Funktioner
	// ---------------------------------------------------------------------------
	function toggleListening() {
		if (!recognition) return;
		if (isListening) {
			recognition.stop();
		} else {
			recognition.start();
			isListening = true;
		}
	}

	function handleImageUpload(event) {
		const file = event.target.files?.[0];
		if (!file) return;
		if (file.size > 4 * 1024 * 1024) {
			alert('Billedet er for stort (maks 4 MB). Komprimer det eller vælg et andet billede.');
			event.target.value = '';
			return;
		}
		imageName = file.name;
		const reader = new FileReader();
		reader.onload = (e) => {
			uploadedImage = e.target.result;
		};
		reader.readAsDataURL(file);
	}

	function handleVideoUpload(event) {
		const file = event.target.files?.[0];
		if (!file) return;
		if (file.size > 8 * 1024 * 1024) {
			alert('Videoen er for stor (maks 8 MB). Optag et kortere klip (under 20 sek.).');
			event.target.value = '';
			return;
		}
		videoName = file.name;
		const reader = new FileReader();
		reader.onload = (e) => {
			uploadedVideo = e.target.result;
		};
		reader.readAsDataURL(file);
	}

	function removeImage() {
		uploadedImage = null;
		imageName = '';
		if (imageFileInput) imageFileInput.value = '';
	}

	function removeVideo() {
		uploadedVideo = null;
		videoName = '';
		if (videoFileInput) videoFileInput.value = '';
	}

	function resetAll() {
		conversation = '[]';
		clarifyMode = false;
		clarifyQuestions = [];
		clarifyMessage = '';
		clarifyAnswers = {};
		originalProblem = '';
		hasOriginalProblem = false;
		problem = '';
		uploadedImage = null;
		uploadedVideo = null;
		imageName = '';
		videoName = '';
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	function difficultyClass(d) {
		return { Let: 'easy', Medium: 'medium', Svær: 'hard' }[d] ?? 'medium';
	}

	function formatPrice(n) {
		return new Intl.NumberFormat('da-DK', {
			style: 'currency',
			currency: 'DKK',
			maximumFractionDigits: 0
		}).format(n);
	}

	function youtubeUrl(terms) {
		return `https://www.youtube.com/results?search_query=${encodeURIComponent(terms)}`;
	}

	function confLabel(c) {
		return { high: 'Høj sikkerhed', medium: 'Medium sikkerhed', low: 'Lav sikkerhed' }[c] ?? '';
	}

	function confClass(c) {
		return { high: 'conf-high', medium: 'conf-medium', low: 'conf-low' }[c] ?? 'conf-medium';
	}

	// Submit-knappen deaktiveres hvis: loading, eller ingen tekst/svar
	let submitDisabled = $derived(
		isLoading ||
			(clarifyMode
				? !clarifyQuestions.some((q) => clarifyAnswers[q.id]?.trim())
				: !problem.trim())
	);
</script>

<svelte:head>
	<title>AutoMind AI — Bilvejleder</title>
	<meta
		name="description"
		content="AI-drevet bilassistent der diagnosticerer problemer og finder reservedele."
	/>
</svelte:head>

<!-- =========================================================================
     HEADER
     ========================================================================= -->
<header class="site-header">
	<div class="container">
		<div class="logo">
			<span class="logo-text">AutoMind <span class="logo-ai">AI</span></span>
		</div>
		<p class="header-tagline">Din intelligente bilvejleder</p>
	</div>
</header>

<!-- =========================================================================
     MAIN INDHOLD
     ========================================================================= -->
<main class="container">
	<!-- Hero-sektion -->
	<section class="hero">
		<h1 class="hero-title">Hvad er der galt med din bil?</h1>
		<p class="hero-subtitle">
			Beskriv problemet, tilføj billede eller video. AutoMind AI stiller kritiske spørgsmål og
			diagnosticerer præcist.
		</p>
	</section>

	<!-- =========================================================================
	     FORMULAR
	     ========================================================================= -->
	<section class="form-section">
		<form
			method="POST"
			use:enhance={({ formData }) => {
				isLoading = true;

				// Send altid samtalehistorik med
				formData.set('conversation', conversation);

				if (clarifyMode) {
					// Kompilér svar på opfølgningsspørgsmål til én sammenhængende tekst
					const compiled = clarifyQuestions
						.map((q) => `${q.question} Svar: ${clarifyAnswers[q.id]?.trim() || '(intet svar)'}`)
						.join('\n');
					formData.set('problem', compiled);
					// Medie er allerede analyseret i første tur — send ikke igen
					formData.delete('image');
					formData.delete('video');
				} else {
					// Normal tilstuploadedImageand — inkludér evt. medie-uploads
					if (uploadedImage) formData.set('image', uploadedImage);
					else formData.delete('image');
					if (uploadedVideo) formData.set('video', uploadedVideo);
					else formData.delete('video');
				}

				return async ({ update }) => {
					await update({ reset: false });
					isLoading = false;
				};
			}}
		>
		
			{#if !clarifyMode}
				<!-- Normal tilstand: problemtekst + medie-upload -->
				<div class="input-group">
					<label for="problem-input" class="input-label">Beskriv dit bilproblem</label>
					<div class="textarea-wrapper">
						<textarea
							id="problem-input"
							name="problem"
							bind:value={problem}
							placeholder="Eksempel: Min bil laver en metallisk skrabende lyd, når jeg bremser. Lyden er værre i koldt vejr..."
							rows="4"
							class="problem-textarea"
							disabled={isLoading}
						></textarea>
						{#if speechSupported}
							<button
								type="button"
								class="mic-button"
								class:mic-active={isListening}
								onclick={toggleListening}
								title={isListening ? 'Stop optagelse' : 'Tal dit problem (dansk)'}
								aria-label={isListening ? 'Stop tale-genkendelse' : 'Start tale-genkendelse'}
								disabled={isLoading}
							>
								{#if isListening}
									<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
										<rect x="6" y="6" width="12" height="12" rx="2" />
									</svg>
									<span class="mic-pulse"></span>
								{:else}
									<svg
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										aria-hidden="true"
									>
										<path d="M12 2a3 3 0 013 3v7a3 3 0 01-6 0V5a3 3 0 013-3z" />
										<path
											d="M19 10v2a7 7 0 01-14 0v-2M12 19v3M8 22h8"
											stroke-linecap="round"
										/>
									</svg>
								{/if}
							</button>
						{/if}
					</div>
					{#if isListening}
						<p class="listening-indicator" aria-live="polite">Lytter... tal nu på dansk</p>
					{/if}
				</div>

				<!-- Medie-upload: billede + video analyseres af Gemini AI -->
				<div class="media-row">
					<!-- Billede-upload -->
					<div class="media-item">
						<input
							type="file"
							accept="image/*"
							id="img-upload"
							bind:this={imageFileInput}
							onchange={handleImageUpload}
							style="display:none"
							disabled={isLoading}
						/>
						{#if !uploadedImage}
							<label for="img-upload" class="media-btn" class:media-btn-disabled={isLoading}>
								<svg
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									aria-hidden="true"
								>
									<path
										d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"
									/>
									<circle cx="12" cy="13" r="4" />
								</svg>
								Tilføj billede
							</label>
						{:else}
							<div class="media-preview image-preview-wrap">
								<img src={uploadedImage} alt="Valgt billede" class="img-thumb" />
								<div class="media-info">
									<span class="media-filename">{imageName}</span>
									<span class="media-ai-badge">AI analyserer</span>
								</div>
								<button
									type="button"
									class="remove-media"
									onclick={removeImage}
									aria-label="Fjern billede"
									disabled={isLoading}
								>
									<svg
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2.5"
										aria-hidden="true"
									>
										<line x1="18" y1="6" x2="6" y2="18" stroke-linecap="round" />
										<line x1="6" y1="6" x2="18" y2="18" stroke-linecap="round" />
									</svg>
								</button>
							</div>
						{/if}
					</div>

					<!-- Video-upload -->
					<div class="media-item">
						<input
							type="file"
							accept="video/*"
							id="vid-upload"
							bind:this={videoFileInput}
							onchange={handleVideoUpload}
							style="display:none"
							disabled={isLoading}
						/>
						{#if !uploadedVideo}
							<label for="vid-upload" class="media-btn" class:media-btn-disabled={isLoading}>
								<svg
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									aria-hidden="true"
								>
									<polygon points="23 7 16 12 23 17 23 7" />
									<rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
								</svg>
								Tilføj video
							</label>
						{:else}
							<div class="media-preview video-preview-wrap">
								<svg
									class="video-icon"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									aria-hidden="true"
								>
									<polygon points="23 7 16 12 23 17 23 7" />
									<rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
								</svg>
								<div class="media-info">
									<span class="media-filename">{videoName}</span>
									<span class="media-ai-badge">AI analyserer</span>
								</div>
								<button
									type="button"
									class="remove-media"
									onclick={removeVideo}
									aria-label="Fjern video"
									disabled={isLoading}
								>
									<svg
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2.5"
										aria-hidden="true"
									>
										<line x1="18" y1="6" x2="6" y2="18" stroke-linecap="round" />
										<line x1="6" y1="6" x2="18" y2="18" stroke-linecap="round" />
									</svg>
								</button>
							</div>
						{/if}
					</div>
				</div>
				<p class="media-hint">Maks 4 MB billede · 8 MB video. Gemini AI analyserer dit visuelle materiale direkte.</p>
			{:else}
				<!-- Clarify-tilstand: vis originalt spørgsmål + AI's opfølgningsspørgsmål -->
				<div class="original-question-box">
					<span class="oq-label">Dit spørgsmål</span>
					<p class="oq-text">"{originalProblem}"</p>
				</div>

				<div class="clarify-banner">
					<svg
						class="clarify-icon"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						aria-hidden="true"
					>
						<circle cx="12" cy="12" r="10" />
						<path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" stroke-linecap="round" />
						<line x1="12" y1="17" x2="12.01" y2="17" stroke-linecap="round" stroke-width="2.5" />
					</svg>
					<p>{clarifyMessage}</p>
				</div>

				<div class="clarify-questions">
					{#each clarifyQuestions as q, i}
						<div class="clarify-question">
							<label for="ans-{q.id}" class="question-label">
								<span class="q-num">{i + 1}</span>
								{q.question}
							</label>
							<input
								id="ans-{q.id}"
								type="text"
								placeholder={q.hint}
								bind:value={clarifyAnswers[q.id]}
								class="clarify-input"
								disabled={isLoading}
							/>
						</div>
					{/each}
				</div>

				<button type="button" class="reset-link" onclick={resetAll} disabled={isLoading}>
					← Stil et helt nyt spørgsmål
				</button>
			{/if}

			<!-- Submit-knap — tekst ændres baseret på tilstand -->
			<button type="submit" class="submit-button" disabled={submitDisabled}>
				{#if isLoading}
					<span class="spinner" aria-hidden="true"></span>
					Analyserer...
				{:else if clarifyMode}
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						aria-hidden="true"
						class="btn-icon"
					>
						<line x1="22" y1="2" x2="11" y2="13" stroke-linecap="round" />
						<polygon points="22 2 15 22 11 13 2 9 22 2" />
					</svg>
					Send svar til AI
				{:else}
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						aria-hidden="true"
						class="btn-icon"
					>
						<path
							d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
					Diagnosticér mit problem
				{/if}
			</button>
		</form>
	</section>

	<!-- =========================================================================
	     FEJL-VISNING
	     ========================================================================= -->
	{#if form?.error}
		<div class="error-banner" role="alert">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
				<circle cx="12" cy="12" r="10" />
				<line x1="12" y1="8" x2="12" y2="12" stroke-linecap="round" />
				<line x1="12" y1="16" x2="12.01" y2="16" stroke-linecap="round" />
			</svg>
			<p>{form.error}</p>
		</div>
	{/if}

	<!-- =========================================================================
	     DIAGNOSE-RESULTATER
	     ========================================================================= -->
	{#if form?.success && form.aiData?.mode === 'diagnose'}
		{@const ai = form.aiData}

		<section class="results" aria-label="AI-diagnoseresultater">
			<!-- Originalt spørgsmål -->
			<div class="result-question">
				<span class="result-question-label">Dit spørgsmål</span>
				<p>"{form.problem}"</p>
			</div>

			<!-- Diagnose-kort med confidence-badge -->
			<div class="diagnosis-card">
				<div class="card-header">
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						aria-hidden="true"
						class="card-icon"
					>
						<path
							d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
						<path d="M9 12h6M9 16h4" stroke-linecap="round" />
					</svg>
					<h2>Mekanikernes diagnose</h2>
					{#if ai.confidence}
						<span class="confidence-badge {confClass(ai.confidence)}">
							{confLabel(ai.confidence)}
						</span>
					{/if}
				</div>
				<p class="diagnosis-text">{ai.diagnose}</p>
			</div>

			<!-- Reservedels-gitter -->
			{#if ai.parts?.length > 0}
				<div class="parts-section">
					<h2 class="section-title">
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							aria-hidden="true"
						>
							<path
								d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
								stroke-linejoin="round"
							/>
							<circle cx="12" cy="12" r="3" />
						</svg>
						Anbefalede reservedele ({ai.parts.length})
					</h2>

					<div class="parts-grid">
						{#each ai.parts as part, i}
							<article class="part-card" aria-label="Reservedel {i + 1}: {part.part_name}">
								<div class="part-card-body">
									<h3 class="part-name">{part.part_name}</h3>
									<dl class="part-details">
										<div class="detail-row">
											<dt>Producent</dt>
											<dd class="detail-value manufacturer">{part.manufacturer}</dd>
										</div>
										<div class="detail-row">
											<dt>OEM-nummer</dt>
											<dd class="detail-value oem">{part.oem_number}</dd>
										</div>
										<div class="detail-row">
											<dt>Estimeret pris</dt>
											<dd class="detail-value price">{formatPrice(part.estimated_price_dkk)}</dd>
										</div>
										<div class="detail-row">
											<dt>Link</dt>
											<dd class="detail-value link">
												<a href="https://www.autodoc.dk/search?q={encodeURIComponent(part.oem_number)}" target="_blank">
												Søg på Autodoc
												</a>
												<a href="https://www.google.com/search?q={encodeURIComponent(`${part.oem_number} ${part.part_name} køb`)}" target="_blank">
												Google
												</a>
											</dd>
										</div>
									</dl>
								</div>
							</article>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Sikkerhedsråd -->
			<div class="advice-card">
				<div class="card-header">
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						aria-hidden="true"
						class="card-icon advice-icon"
					>
						<path
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
					<h2>Sikkerhedsråd</h2>
				</div>
				<p class="advice-text">{ai.advice}</p>
			</div>

			<!-- YouTube reparationsvideo-link -->
			{#if ai.repair_search_terms}
				<div class="youtube-section">
					<div class="card-header">
						<svg
							class="card-icon yt-icon"
							viewBox="0 0 24 24"
							fill="currentColor"
							aria-hidden="true"
						>
							<path
								d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"
							/>
						</svg>
						<h2>Reparationsvideo</h2>
					</div>
					<p class="yt-description">
						Find vejledende reparationsvideoer til dette problem på YouTube.
					</p>
					<a
						href={youtubeUrl(ai.repair_search_terms)}
						target="_blank"
						rel="noopener noreferrer"
						class="youtube-link"
					>
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							aria-hidden="true"
						>
							<circle cx="12" cy="12" r="10" />
							<polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" />
						</svg>
						Se reparationsvideoer på YouTube
					</a>
					<p class="yt-search-terms">Søgning: "{ai.repair_search_terms}"</p>
				</div>
			{/if}

			<!-- Opfølgningsspørgsmål / start forfra -->
			<div class="followup-actions">
				<p class="followup-hint">
					Har du et opfølgningsspørgsmål om denne diagnose? Skriv det i formularen ovenfor — AI'en
					husker bilens oplysninger.
				</p>
				<button type="button" class="reset-btn" onclick={resetAll}>
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						aria-hidden="true"
					>
						<polyline points="1 4 1 10 7 10" />
						<path d="M3.51 15a9 9 0 102.13-9.36L1 10" stroke-linecap="round" />
					</svg>
					Start helt forfra
				</button>
			</div>
		</section>
	{/if}
</main>

<!-- =========================================================================
     FOOTER
     ========================================================================= -->
<footer class="site-footer">
	<div class="container">
		<p>
			AutoMind AI er vejledende. Konsultér altid en certificeret mekaniker ved alvorlige
			bilproblemer.
		</p>
	</div>
</footer>

<!-- =========================================================================
     STYLES
     ========================================================================= -->
<style>
	/* -------------------------------------------------------------------------
	   Design tokens
	   ------------------------------------------------------------------------- */
	:global(:root) {
		--clr-bg: #f0f2f5;
		--clr-surface: #ffffff;
		--clr-surface-2: #f8f9fa;
		--clr-border: #e2e8f0;
		--clr-primary: #021f44;
		--clr-primary-hover: #16304f;
		--clr-accent: #e85d04;
		--clr-accent-light: #fff3ec;
		--clr-text: #1a202c;
		--clr-text-muted: #64748b;
		--clr-success: #065f46;
		--clr-success-bg: #ecfdf5;
		--clr-easy: #059669;
		--clr-easy-bg: #d1fae5;
		--clr-medium: #b45309;
		--clr-medium-bg: #fef3c7;
		--clr-hard: #dc2626;
		--clr-hard-bg: #fee2e2;
		--clr-error: #991b1b;
		--clr-error-bg: #fee2e2;
		--radius-sm: 8px;
		--radius-md: 12px;
		--radius-lg: 16px;
		--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.05);
		--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06);
		--shadow-lg: 0 10px 30px rgba(0, 0, 0, 0.1), 0 4px 8px rgba(0, 0, 0, 0.06);
		--font-sans: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
	}

	:global(*) {
		box-sizing: border-box;
		margin: 0;
		padding: 0;
	}

	:global(body) {
		background: var(--clr-bg);
		color: var(--clr-text);
		font-family: var(--font-sans);
		font-size: 1rem;
		line-height: 1.6;
		min-height: 100vh;
		-webkit-font-smoothing: antialiased;
	}

	/* -------------------------------------------------------------------------
	   Layout
	   ------------------------------------------------------------------------- */
	.container {
		max-width: 780px;
		margin: 0 auto;
		padding: 0 1.25rem;
	}

	/* -------------------------------------------------------------------------
	   Header
	   ------------------------------------------------------------------------- */
	.site-header {
		background: var(--clr-primary);
		color: #fff;
		padding: 1.25rem 0;
		box-shadow: var(--shadow-md);
	}

	.site-header .container {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.logo {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.logo-icon {
		width: 2rem;
		height: 2rem;
		color: var(--clr-accent);
	}

	.logo-text {
		font-size: 1.4rem;
		font-weight: 700;
		letter-spacing: -0.02em;
	}

	.logo-ai {
		color: var(--clr-accent);
	}

	.header-tagline {
		font-size: 0.85rem;
		opacity: 0.75;
		font-style: italic;
	}

	/* -------------------------------------------------------------------------
	   Hero
	   ------------------------------------------------------------------------- */
	.hero {
		padding: 2.5rem 0 1.5rem;
		text-align: center;
	}

	.hero-title {
		font-size: clamp(1.6rem, 4vw, 2.2rem);
		font-weight: 800;
		color: var(--clr-primary);
		letter-spacing: -0.03em;
		line-height: 1.2;
		margin-bottom: 0.75rem;
	}

	.hero-subtitle {
		color: var(--clr-text-muted);
		font-size: 1rem;
		max-width: 560px;
		margin: 0 auto;
	}

	/* -------------------------------------------------------------------------
	   Formular
	   ------------------------------------------------------------------------- */
	.form-section {
		background: var(--clr-surface);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-md);
		padding: 1.75rem;
		margin-bottom: 1.5rem;
	}

	.input-group {
		margin-bottom: 1.25rem;
	}

	.input-label {
		display: block;
		font-weight: 600;
		font-size: 0.9rem;
		color: var(--clr-primary);
		margin-bottom: 0.5rem;
	}

	.textarea-wrapper {
		position: relative;
	}

	.problem-textarea {
		width: 100%;
		padding: 0.9rem 3.5rem 0.9rem 1rem;
		border: 2px solid var(--clr-border);
		border-radius: var(--radius-md);
		font-family: var(--font-sans);
		font-size: 0.95rem;
		color: var(--clr-text);
		background: var(--clr-surface-2);
		resize: vertical;
		transition: border-color 0.2s, box-shadow 0.2s;
		line-height: 1.6;
	}

	.problem-textarea:focus {
		outline: none;
		border-color: var(--clr-primary);
		box-shadow: 0 0 0 3px rgba(30, 58, 95, 0.12);
		background: var(--clr-surface);
	}

	.problem-textarea:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	/* Mikrofon-knap */
	.mic-button {
		position: absolute;
		top: 0.65rem;
		right: 0.65rem;
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 50%;
		border: none;
		background: var(--clr-primary);
		color: #fff;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.2s, transform 0.1s;
		flex-shrink: 0;
	}

	.mic-button svg {
		width: 1.1rem;
		height: 1.1rem;
	}

	.mic-button:hover:not(:disabled) {
		background: var(--clr-primary-hover);
		transform: scale(1.05);
	}

	.mic-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.mic-button.mic-active {
		background: var(--clr-hard);
		position: relative;
	}

	.mic-pulse {
		position: absolute;
		inset: -4px;
		border-radius: 50%;
		border: 2px solid var(--clr-hard);
		animation: pulse-ring 1.2s ease-out infinite;
		pointer-events: none;
	}

	@keyframes pulse-ring {
		0% {
			transform: scale(1);
			opacity: 0.8;
		}
		100% {
			transform: scale(1.6);
			opacity: 0;
		}
	}

	.listening-indicator {
		margin-top: 0.5rem;
		font-size: 0.85rem;
		color: var(--clr-hard);
		font-weight: 500;
		animation: blink 1.2s ease-in-out infinite;
	}

	@keyframes blink {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.4;
		}
	}

	/* -------------------------------------------------------------------------
	   Medie-upload (billede + video)
	   ------------------------------------------------------------------------- */
	.media-row {
		display: flex;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
		flex-wrap: wrap;
	}

	.media-item {
		flex: 1;
		min-width: 140px;
	}

	.media-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.65rem 1rem;
		border: 2px dashed var(--clr-border);
		border-radius: var(--radius-md);
		background: var(--clr-surface-2);
		color: var(--clr-text-muted);
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		transition: border-color 0.2s, background 0.2s, color 0.2s;
		width: 100%;
		justify-content: center;
	}

	.media-btn:hover:not(.media-btn-disabled) {
		border-color: var(--clr-primary);
		background: #eef2f8;
		color: var(--clr-primary);
	}

	.media-btn-disabled {
		opacity: 0.5;
		cursor: not-allowed;
		pointer-events: none;
	}

	.media-btn svg {
		width: 1.1rem;
		height: 1.1rem;
		flex-shrink: 0;
	}

	/* Billede-forhåndsvisning */
	.media-preview {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.5rem 0.75rem;
		border: 2px solid var(--clr-border);
		border-radius: var(--radius-md);
		background: var(--clr-surface-2);
		width: 100%;
	}

	.image-preview-wrap {
		border-color: #bfdbfe;
		background: #eff6ff;
	}

	.video-preview-wrap {
		border-color: #bbf7d0;
		background: #f0fdf4;
	}

	.img-thumb {
		width: 44px;
		height: 44px;
		object-fit: cover;
		border-radius: 6px;
		flex-shrink: 0;
	}

	.video-icon {
		width: 1.5rem;
		height: 1.5rem;
		flex-shrink: 0;
		color: var(--clr-easy);
	}

	.media-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.media-filename {
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--clr-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.media-ai-badge {
		font-size: 0.68rem;
		font-weight: 700;
		color: var(--clr-primary);
		background: #dbeafe;
		padding: 0.1em 0.45em;
		border-radius: 99px;
		width: fit-content;
	}

	.remove-media {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.25rem;
		color: var(--clr-text-muted);
		border-radius: 50%;
		display: flex;
		align-items: center;
		transition: background 0.15s, color 0.15s;
		flex-shrink: 0;
	}

	.remove-media:hover:not(:disabled) {
		background: var(--clr-hard-bg);
		color: var(--clr-hard);
	}

	.remove-media svg {
		width: 1rem;
		height: 1rem;
	}

	.media-hint {
		font-size: 0.78rem;
		color: var(--clr-text-muted);
		margin-bottom: 1.25rem;
	}

	/* -------------------------------------------------------------------------
	   Clarify-tilstand: originalt spørgsmål + AI's spørgsmål
	   ------------------------------------------------------------------------- */
	.original-question-box {
		background: var(--clr-surface-2);
		border-left: 3px solid var(--clr-primary);
		border-radius: var(--radius-sm);
		padding: 0.85rem 1.1rem;
		margin-bottom: 1rem;
	}

	.oq-label {
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--clr-text-muted);
		display: block;
		margin-bottom: 0.3rem;
	}

	.oq-text {
		font-style: italic;
		color: var(--clr-text);
		font-size: 0.92rem;
	}

	.clarify-banner {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		background: #eff6ff;
		border: 1px solid #bfdbfe;
		border-radius: var(--radius-md);
		padding: 1rem 1.25rem;
		margin-bottom: 1.25rem;
		color: #1e40af;
	}

	.clarify-icon {
		width: 1.35rem;
		height: 1.35rem;
		flex-shrink: 0;
		margin-top: 0.1rem;
		color: #2563eb;
	}

	.clarify-banner p {
		font-size: 0.95rem;
		font-weight: 500;
		line-height: 1.5;
	}

	.clarify-questions {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.clarify-question {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.question-label {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-weight: 600;
		font-size: 0.92rem;
		color: var(--clr-primary);
	}

	.q-num {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 50%;
		background: var(--clr-primary);
		color: #fff;
		font-size: 0.75rem;
		font-weight: 800;
		flex-shrink: 0;
	}

	.clarify-input {
		padding: 0.75rem 1rem;
		border: 2px solid var(--clr-border);
		border-radius: var(--radius-md);
		font-family: var(--font-sans);
		font-size: 0.95rem;
		color: var(--clr-text);
		background: var(--clr-surface-2);
		transition: border-color 0.2s, box-shadow 0.2s;
		width: 100%;
	}

	.clarify-input:focus {
		outline: none;
		border-color: var(--clr-primary);
		box-shadow: 0 0 0 3px rgba(30, 58, 95, 0.12);
		background: var(--clr-surface);
	}

	.clarify-input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.reset-link {
		display: inline-block;
		background: none;
		border: none;
		cursor: pointer;
		font-size: 0.85rem;
		color: var(--clr-text-muted);
		padding: 0.3rem 0;
		margin-bottom: 1rem;
		text-decoration: underline;
		text-decoration-style: dotted;
		transition: color 0.15s;
	}

	.reset-link:hover:not(:disabled) {
		color: var(--clr-primary);
	}

	/* Submit-knap */
	.submit-button {
		width: 100%;
		padding: 0.9rem 1.5rem;
		background: var(--clr-accent);
		color: #fff;
		border: none;
		border-radius: var(--radius-md);
		font-size: 1rem;
		font-weight: 700;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		transition: background 0.2s, transform 0.1s, box-shadow 0.2s;
		letter-spacing: 0.01em;
		box-shadow: var(--shadow-sm);
		margin-top: 0.25rem;
	}

	.submit-button:hover:not(:disabled) {
		background: #c94d00;
		transform: translateY(-1px);
		box-shadow: var(--shadow-md);
	}

	.submit-button:active:not(:disabled) {
		transform: translateY(0);
	}

	.submit-button:disabled {
		opacity: 0.55;
		cursor: not-allowed;
		transform: none;
	}

	.btn-icon {
		width: 1.1rem;
		height: 1.1rem;
	}

	.spinner {
		display: inline-block;
		width: 1rem;
		height: 1rem;
		border: 2px solid rgba(255, 255, 255, 0.4);
		border-top-color: #fff;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* -------------------------------------------------------------------------
	   Fejl-banner
	   ------------------------------------------------------------------------- */
	.error-banner {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		background: var(--clr-error-bg);
		border: 1px solid #fca5a5;
		border-radius: var(--radius-md);
		padding: 1rem 1.25rem;
		margin-bottom: 1.5rem;
		color: var(--clr-error);
	}

	.error-banner svg {
		width: 1.25rem;
		height: 1.25rem;
		flex-shrink: 0;
		margin-top: 0.1rem;
	}

	.error-banner p {
		font-size: 0.95rem;
		font-weight: 500;
	}

	/* -------------------------------------------------------------------------
	   Resultater
	   ------------------------------------------------------------------------- */
	.results {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		padding-bottom: 2rem;
		animation: fade-up 0.4s ease-out;
	}

	@keyframes fade-up {
		from {
			opacity: 0;
			transform: translateY(16px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.result-question {
		background: var(--clr-surface);
		border-left: 3px solid var(--clr-primary);
		border-radius: var(--radius-sm);
		padding: 0.85rem 1.1rem;
		box-shadow: var(--shadow-sm);
	}

	.result-question-label {
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--clr-text-muted);
		display: block;
		margin-bottom: 0.3rem;
	}

	.result-question p {
		font-style: italic;
		color: var(--clr-text);
		font-size: 0.95rem;
	}

	/* Diagnose-kort */
	.card-header {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-bottom: 0.85rem;
		flex-wrap: wrap;
	}

	.card-header h2 {
		font-size: 1.05rem;
		font-weight: 700;
		color: var(--clr-primary);
	}

	.card-icon {
		width: 1.35rem;
		height: 1.35rem;
		color: var(--clr-primary);
		flex-shrink: 0;
	}

	.diagnosis-card {
		background: var(--clr-surface);
		border-radius: var(--radius-lg);
		padding: 1.5rem;
		box-shadow: var(--shadow-md);
		border-top: 4px solid var(--clr-primary);
	}

	.diagnosis-text {
		color: var(--clr-text);
		line-height: 1.75;
		font-size: 0.97rem;
	}

	/* Confidence badge */
	.confidence-badge {
		font-size: 0.72rem;
		font-weight: 700;
		padding: 0.2em 0.7em;
		border-radius: 99px;
		margin-left: auto;
		white-space: nowrap;
	}

	.conf-high {
		background: var(--clr-easy-bg);
		color: var(--clr-easy);
	}

	.conf-medium {
		background: var(--clr-medium-bg);
		color: var(--clr-medium);
	}

	.conf-low {
		background: var(--clr-hard-bg);
		color: var(--clr-hard);
	}

	/* Reservedels-sektion */
	.parts-section {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.section-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 1.05rem;
		font-weight: 700;
		color: var(--clr-primary);
	}

	.section-title svg {
		width: 1.25rem;
		height: 1.25rem;
	}

	.parts-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1rem;
	}

	@media (min-width: 520px) {
		.parts-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	.part-card {
		background: var(--clr-surface);
		border-radius: var(--radius-md);
		overflow: hidden;
		box-shadow: var(--shadow-sm);
		border: 1px solid var(--clr-border);
		transition: box-shadow 0.25s, transform 0.25s;
		display: flex;
		flex-direction: column;
	}

	.part-card:hover {
		box-shadow: var(--shadow-lg);
		transform: translateY(-3px);
	}

	.part-image-wrapper {
		position: relative;
		width: 100%;
		height: 160px;
		overflow: hidden;
		background: #e2e8f0;
	}

	.part-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		transition: transform 0.4s ease;
	}

	.part-card:hover .part-image {
		transform: scale(1.05);
	}

	.badge-overlay {
		position: absolute;
		top: 0.6rem;
		right: 0.6rem;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
	}

	.part-card-body {
		padding: 1rem 1.1rem 1.1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		flex: 1;
	}

	.part-name {
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--clr-primary);
		line-height: 1.35;
	}

	.difficulty-badge {
		font-size: 0.72rem;
		font-weight: 700;
		padding: 0.2em 0.6em;
		border-radius: 99px;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.difficulty-easy {
		background: var(--clr-easy-bg);
		color: var(--clr-easy);
	}

	.difficulty-medium {
		background: var(--clr-medium-bg);
		color: var(--clr-medium);
	}

	.difficulty-hard {
		background: var(--clr-hard-bg);
		color: var(--clr-hard);
	}

	.part-details {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.detail-row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 0.5rem;
		font-size: 0.875rem;
		border-bottom: 1px dashed var(--clr-border);
		padding-bottom: 0.4rem;
	}

	.detail-row:last-child {
		border-bottom: none;
		padding-bottom: 0;
	}

	.detail-row dt {
		color: var(--clr-text-muted);
		font-weight: 500;
		flex-shrink: 0;
	}

	.detail-value {
		font-weight: 600;
		text-align: right;
		word-break: break-word;
	}

	.manufacturer {
		color: var(--clr-primary);
	}

	.oem {
		font-family: 'Courier New', monospace;
		font-size: 0.82rem;
		color: var(--clr-text-muted);
		background: var(--clr-surface-2);
		padding: 0.1em 0.35em;
		border-radius: 4px;
	}

	.price {
		color: var(--clr-accent);
		font-size: 1rem;
	}

	.link{
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	/* Råd-kort */
	.advice-card {
		background: #fffbeb;
		border-radius: var(--radius-lg);
		padding: 1.5rem;
		box-shadow: var(--shadow-sm);
		border: 1px solid #fde68a;
	}

	.advice-icon {
		color: #b45309;
	}

	.advice-text {
		color: #78350f;
		line-height: 1.75;
		font-size: 0.97rem;
	}

	/* -------------------------------------------------------------------------
	   YouTube reparationsvideo-sektion
	   ------------------------------------------------------------------------- */
	.youtube-section {
		background: var(--clr-surface);
		border-radius: var(--radius-lg);
		padding: 1.5rem;
		box-shadow: var(--shadow-sm);
		border: 1px solid #fecaca;
	}

	.yt-icon {
		color: #dc2626;
		width: 1.5rem;
		height: 1.5rem;
	}

	.yt-description {
		font-size: 0.9rem;
		color: var(--clr-text-muted);
		margin-bottom: 0.85rem;
	}

	.youtube-link {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.65rem 1.25rem;
		background: #dc2626;
		color: #fff;
		border-radius: var(--radius-md);
		font-weight: 700;
		font-size: 0.9rem;
		text-decoration: none;
		transition: background 0.2s, transform 0.1s;
		box-shadow: var(--shadow-sm);
	}

	.youtube-link:hover {
		background: #b91c1c;
		transform: translateY(-1px);
		box-shadow: var(--shadow-md);
	}

	.youtube-link svg {
		width: 1rem;
		height: 1rem;
	}

	.yt-search-terms {
		margin-top: 0.6rem;
		font-size: 0.78rem;
		color: var(--clr-text-muted);
		font-style: italic;
	}

	/* -------------------------------------------------------------------------
	   Opfølgnings-handlinger (efter diagnose)
	   ------------------------------------------------------------------------- */
	.followup-actions {
		background: var(--clr-surface-2);
		border-radius: var(--radius-md);
		padding: 1.25rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
		border: 1px solid var(--clr-border);
	}

	.followup-hint {
		font-size: 0.875rem;
		color: var(--clr-text-muted);
		flex: 1;
	}

	.reset-btn {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.6rem 1.1rem;
		background: var(--clr-surface);
		color: var(--clr-primary);
		border: 2px solid var(--clr-primary);
		border-radius: var(--radius-md);
		font-weight: 700;
		font-size: 0.875rem;
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
		white-space: nowrap;
	}

	.reset-btn:hover {
		background: var(--clr-primary);
		color: #fff;
	}

	.reset-btn svg {
		width: 1rem;
		height: 1rem;
	}

	/* -------------------------------------------------------------------------
	   Nummerplade-felt
	   ------------------------------------------------------------------------- */
	.plate-group {
		margin-bottom: 1.25rem;
	}

	.optional-tag {
		font-size: 0.75rem;
		font-weight: 400;
		color: var(--clr-text-muted);
		margin-left: 0.4rem;
	}

	.plate-wrapper {
		display: flex;
		align-items: stretch;
		max-width: 220px;
		border-radius: var(--radius-sm);
		overflow: hidden;
		box-shadow: var(--shadow-sm);
		border: 2px solid #1a3a72;
	}

	.plate-flag {
		background: #003399;
		color: #fff;
		font-size: 0.65rem;
		font-weight: 900;
		letter-spacing: 0.05em;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0 0.5rem;
		writing-mode: vertical-lr;
		text-orientation: mixed;
		transform: rotate(180deg);
		min-width: 1.6rem;
		user-select: none;
	}

	.plate-input {
		flex: 1;
		background: #f5d32a;
		border: none;
		padding: 0.6rem 0.75rem;
		font-family: 'Courier New', 'Lucida Console', monospace;
		font-size: 1.15rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		color: #111;
		text-transform: uppercase;
		outline: none;
		min-width: 0;
		transition: background 0.15s;
	}

	.plate-input::placeholder {
		color: rgba(0, 0, 0, 0.35);
		font-weight: 600;
		letter-spacing: 0.08em;
	}

	.plate-input:focus {
		background: #ffe033;
	}

	.plate-input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* -------------------------------------------------------------------------
	   Footer
	   ------------------------------------------------------------------------- */
	.site-footer {
		background: var(--clr-primary);
		color: rgba(255, 255, 255, 0.6);
		text-align: center;
		padding: 1.25rem 0;
		font-size: 0.82rem;
		margin-top: 2rem;
	}
</style>
