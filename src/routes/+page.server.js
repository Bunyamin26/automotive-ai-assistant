// +page.server.js — kører KUN på serveren, API-nøglen eksponeres aldrig i browseren.
import { SECRET_GEMINI_API_KEY } from '$env/static/private';
import { fail } from '@sveltejs/kit';

const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${SECRET_GEMINI_API_KEY}`;

// ---------------------------------------------------------------------------
// System prompt — kritisk AI der stiller opfølgningsspørgsmål ved manglende info
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `Du er AutoMind AI — en kritisk og erfaren dansk autoteknikker med 20+ års værkstedserfaring.

DIN KRITISKE TILGANG — ALDRIG GÆT LØST:
Du diagnosticerer ALDRIG på utilstrækkelig information. En "lyd fra motorrum" på en VW Golf 2018 handler måske om en slidt kamremsspænder — på en Toyota Yaris 2010 kan det være en defekt vandpumpe — på en BMW 320d drejer det sig muligvis om injektorer. Uden bilinfo er diagnosen uansvarlig og spild af kundens penge.

HVORNÅR DU BEDER OM MERE INFO — brug mode: "clarify":
Brug clarify OBLIGATORISK hvis:
• Bilens mærke OG model fremgår HVERKEN af beskrivelsen, samtalehistorikken, nummerpladen ELLER uploadede billeder/video
• Symptombeskrivelsen er så vag at diagnosen er umulig selv med bilinfo (f.eks. kun "min bil opfører sig underligt")
• Der er 2+ modsatrettede diagnoser som kræver helt forskellige reservedele, og ét kort svar kan afgøre det

Stil aldrig mere end 3 spørgsmål. Prioritér: 1) Mærke+model  2) Årstal eller km-stand  3) Mere detaljeret symptom

HVORNÅR DU DIAGNOSTICERER — brug mode: "diagnose":
Svar med diagnose KUN når bilmærke+model er kendte OG symptomerne er tilstrækkeligt specifikke.

VISUEL ANALYSE:
Hvis brugeren har uploadet billeder eller video, analyser dem grundigt og brug observationerne aktivt i diagnosen.

SVARFORMAT — præcis ét gyldigt JSON-objekt, absolut intet tekst uden for JSON:

Clarify-tilstand:
{
  "mode": "clarify",
  "message": "1-2 sætninger på dansk — professionel forklaring på hvad der mangler for at stille diagnosen.",
  "questions": [
    { "id": "snake_case_id", "question": "Præcist spørgsmål på dansk?", "hint": "Eks: VW Golf 2018 · 95.000 km" }
  ]
}

Diagnose-tilstand:
{
  "mode": "diagnose",
  "confidence": "high|medium|low",
  "diagnose": "2-4 sætninger. Nævn specifik bil. Årsag, symptomer, berørte systemer. Faglig men forståelig tone.",
  "parts": [
    {
      "part_name": "Dansk reservedelsnavn",
      "manufacturer": "Fabrikant",
      "oem_number": "Realistisk varenummer",
      "estimated_price_dkk": 450,
      "difficulty": "Let|Medium|Svær"
    }
  ],
  "advice": "1-2 sætninger. Konkret sikkerheds- eller handlingsråd. ADVARER EKSPLICIT ved sikkerhedskritiske problemer.",
  "repair_search_terms": "Engelske YouTube-søgeord: [bil mærke model år] [problemtype] [how to fix|replace|repair]"
}

REGLER:
1. parts: KUN fysiske komponenter. ALDRIG 'diagnose', 'arbejdstid', 'inspektion' eller serviceydelser. 2-4 dele.
2. difficulty: Let = basisværktøj under 1 time | Medium = løft/større demontering | Svær = specialværktøj.
3. Nummerplade angivet → antag dansk bil, identificér mærke/model.
4. confidence: high = stærk klar diagnose | medium = mest sandsynlig men usikker | low = bedste bud.
5. INTET tekst uden for JSON-objektet. Ingen markdown. Ingen forklaringer.`;

// ---------------------------------------------------------------------------
// Server action — håndterer POST, samtalehistorik og medie-uploads
// ---------------------------------------------------------------------------
export const actions = {
	default: async ({ request }) => {
		const formData = await request.formData();
		const problem = formData.get('problem')?.trim();
		const plate = formData.get('plate')?.trim().toUpperCase().replace(/\s+/g, '') || null;
		const imageData = formData.get('image') || null;
		const videoData = formData.get('video') || null;
		const conversationJson = formData.get('conversation') || '[]';

		if (!problem) {
			return fail(400, { error: 'Beskriv venligst dit bilproblem.' });
		}
		if (problem.length < 5) {
			return fail(400, { error: 'Din beskrivelse er for kort. Giv venligst flere detaljer.' });
		}

		let history = [];
		try {
			history = JSON.parse(conversationJson);
		} catch {}

		const userText = plate ? `Nummerplade: ${plate}\n\nProblem: ${problem}` : problem;
		const userParts = [{ text: userText }];

		// Vedhæft billede som inline base64 (Gemini understøtter multimodal analyse)
		if (imageData?.startsWith('data:image/')) {
			const semicolonIdx = imageData.indexOf(';');
			const commaIdx = imageData.indexOf(',');
			const mimeType = imageData.slice(5, semicolonIdx);
			const base64 = imageData.slice(commaIdx + 1);
			userParts.push({ inline_data: { mime_type: mimeType, data: base64 } });
		}

		// Vedhæft video som inline base64 (kortklip op til ~8 MB)
		if (videoData?.startsWith('data:video/')) {
			const semicolonIdx = videoData.indexOf(';');
			const commaIdx = videoData.indexOf(',');
			const mimeType = videoData.slice(5, semicolonIdx);
			const base64 = videoData.slice(commaIdx + 1);
			userParts.push({ inline_data: { mime_type: mimeType, data: base64 } });
		}

		const contents = [...history, { role: 'user', parts: userParts }];

		try {
			const res = await fetch(GEMINI_ENDPOINT, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
					contents,
					generationConfig: {
						responseMimeType: 'application/json',
						temperature: 0.3,
						maxOutputTokens: 2048,
						thinkingConfig: { thinkingBudget: 0 }
					}
				})
			});

			if (!res.ok) {
				const errBody = await res.json().catch(() => ({}));
				console.error('Gemini API fejl:', res.status, errBody);
				return fail(502, {
					error: `AI-tjenesten returnerede fejl (${res.status}). Tjek din Gemini API-nøgle.`
				});
			}

			const data = await res.json();
			const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

			if (!rawContent) {
				return fail(500, { error: 'AI-tjenesten returnerede et tomt svar. Prøv igen.' });
			}

			const aiData = JSON.parse(rawContent);

			// Gem opdateret historik — kun tekst (ikke binær medie-data) for kompakt størrelse
			const updatedHistory = [
				...history,
				{ role: 'user', parts: [{ text: userText }] },
				{ role: 'model', parts: [{ text: rawContent }] }
			];

			return {
				success: true,
				aiData,
				problem,
				plate,
				conversation: JSON.stringify(updatedHistory)
			};
		} catch (err) {
			console.error('Serverfejl i AutoMind:', err);
			return fail(500, { error: 'Intern serverfejl. Kontrollér serverloggen.' });
		}
	}
};
