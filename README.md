# AutoMind AI 

AutoMind AI is a smart assistant made to help car owners and mechanics figure out what's wrong with a car and find the exact parts needed to fix it. This project was developed as a hands-on prototype for the individual exam in the AI-programming course at Aalborg University (AAU) in June 2026.

Instead of just acting like a regular chatbot that throws out random guesses, this system works like a real, careful mechanic. It listens to what is wrong, looks at pictures or videos, and makes sure it has enough details before suggesting a repair path.

---

## What the System Does

### Careful Diagnostic Checks
The system is built to not guess blindly. If you give it a vague description like "my car makes a weird noise," it won't just throw parts at the problem. Instead, it enters a clarification mode where it stops and asks you specific questions—like the make, model, or when the noise happens. Once you provide those missing details, it switches gears and gives you a clear diagnosis along with a structured list of parts.

### Photo and Video Analysis
Cars are visual, so the system lets you upload a picture or a short video of the issue—whether that is a fluid leak under the engine, a worn-out belt, or a strange dashboard light. The system processes these files on the server and passes them to the AI model, allowing it to look at the visual evidence alongside your text description to figure out the problem.

### Voice Input (Speak or Type)
To make things easier when you are working on a car and your hands are dirty, you don't have to type everything out. You can click a microphone button and describe the issue out loud in Danish. The system translates your speech into text in real time right inside your browser window.

### Smart Part Cards and Video Guides
When the system suggests a list of parts, it doesn't just give you a wall of text. It organizes them into clean cards that tell you the part name, a realistic manufacturer number, and how hard it is to replace ("Let", "Medium", or "Svær"). It color-codes these difficulty levels so you can see at a glance if it's a quick driveway fix or a major job. It also creates direct links to YouTube repair videos based on the specific parts it finds.

---

## Tech Stack and Setup

* **Frontend**: SvelteKit using the new Svelte 5 engine to keep the screen updates fast and smooth.
* **Backend Layer**: SvelteKit Server Actions, which keep the communication with the AI separate from the browser.
* **AI Engine**: Google Gemini 2.5 Flash. All the heavy lifting and reasoning are done through this model, configured to send back structured data without unnecessary conversational fluff.
* **Security**: The private Gemini API key is kept completely on the server side so it can never be seen or accessed by anyone using the website.

---

## How to Run It Locally

### Prerequisites
You will need Node.js installed on your computer.

1. Clone the repository to your machine:
git clone https://github.com/Bunyamin26/automotive-ai-assistant.git
cd automotive-ai-assistant

2. Install the necessary project pieces:
npm install

3. Set up your API key:
Create a file named `.env` in the main folder and add your private Gemini API key from Google AI Studio:
SECRET_GEMINI_API_KEY=your_actual_api_key_here

4. Start the development server:
npm run dev

Now, open your browser to `http://localhost:5173` to try out the application.

---

## Project Links
* **Source Code Repository**: https://github.com/Bunyamin26/automotive-ai-assistant
* **Video Demonstration (1-Minute)**: https://youtu.be/G_koGFnNfCo
* **Interactive Live Website**: https://automotive-ai-assistant.vercel.app/