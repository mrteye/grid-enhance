# Grid Enhance Engine

The **Grid Enhance Engine** is a next-generation image editor that uses generative AI to expand and enhance images, creating a limitless space for creativity. It began with a simple but challenging goal: to break the boundaries of a fixed digital canvas. Standard AI image generators create amazing art, but often at a set resolution. The question was, how can we not only upscale these images but organically *grow* them, adding new, high-resolution detail section by section?

This project is the answer. It's a next-generation image editor that uses generative AI to expand and enhance images, creating a limitless space for creativity.

-----

### **▶️ Live Demo & Video**

*   **Live Application:** [https://grid-enhance.vercel.app](https://grid-enhance.vercel.app/)
*   **Video Demo (2 mins):** [https://your-video-link.com](https://www.google.com/search?q=https://your-video-link.com) *(\<-- Replace with your public video link)*

-----

### **🚀 About The Project**

Traditional image editors are constrained by a fixed canvas. Your creativity is limited by the pixels you start with. The Grid Enhance Engine shatters this limitation.

This tool divides any image into a grid, allowing you to modify, regenerate, or completely replace individual sections using simple text commands. The application's core innovation is its **dynamic scaling algorithm**: when a grid section is replaced with a higher-resolution image, the entire canvas intelligently resizes to accommodate the new content, seamlessly blending original and generated data into a new, larger composition.

### **✨ Key Features**

*   **Dynamic Canvas Scaling:** The canvas intelligently grows to fit higher-resolution AI-generated or manually uploaded grid sections.
*   **AI-Powered Cell Modification:** Use text commands with the Gemini model to transform any grid section.
*   **Generative Start:** Don't have an image? Generate a base image from a text prompt to kickstart your project.
*   **Manual Grid Replacement:** Upload your own images to any grid cell for precise control.
*   **Crop & Resize:** Easily crop the canvas to a selection of cells, creating a new base image from your favorite part of the composition.
*   **Undo/Redo History:** Step backward and forward through your changes with a multi-level undo/redo system.
*   **Prompt Assists:** Create and manage a library of reusable prompt snippets to speed up your creative workflow.
*   **Project Persistence:** Save your entire project (base image, grid, replacements, metadata) to a local JSON file and load it later to continue your work.
*   **High-Resolution Export:** Export the final, dynamically-scaled composite image as a high-quality PNG.
*   **Interactive UI:** Simple controls for grid size, grid visibility, and project metadata.

### **🛠️ Tech Stack**

*   Vanilla JavaScript (ES6)
*   HTML5 & CSS3
*   Tailwind CSS
*   Google Gemini API

### **🏁 Getting Started & Running Locally**

1.  **Clone the repository:**
    ```sh
    git clone https://github.com/mrteye/grid-enhance.git
    cd grid-enhance
    ```
2.  **Get a Gemini API Key:**
    *   Create a Gemini API key from Google AI Studio.
3.  **Run a Local Web Server:**
    To ensure all features (like API calls) work correctly, you need to run the project from a local server. Opening `index.html` directly from the filesystem may cause security errors in your browser.
    *   **Recommended (Node.js):** If you have Node.js installed, run this command from the project's root directory:
        ```sh
        npx http-server
        ```
        Then open your browser to `http://localhost:8080` (or the URL it provides).
    *   **Alternative (Python):** If you have Python installed, you can use its built-in server:
        ```sh
        python -m http.server
        ```
        Then open your browser to `http://localhost:8000`.
4.  **Use the App:**
    *   Paste your API key into the input field in the control panel.
    *   Upload a base image or start with a prompt to begin creating.

### **💻 Development with VS Code**

This project is set up for easy editing and contribution, especially with Visual Studio Code.

*   **Live Server Extension:** For a seamless development experience, you can use the Live Server extension in VS Code. Simply right-click on `index.html` and select "Open with Live Server". This will automatically start a server and reload the page whenever you save a file.
*   **Gemini Code Assist:** If you have the Google Gemini for VS Code extension, you can use it to help you understand, debug, and add new features to the codebase. Just open the chat and start asking questions about the code!

### **☁️ Deployment to Vercel**

This project is optimized for zero-configuration deployment on Vercel.

1.  Push this repository to your GitHub account (`mrteye`).
2.  Go to Vercel and sign up with your GitHub account.
3.  Click "**Add New...**" \> "**Project**".
4.  Select your new `grid-enhance` repository and click "**Import**".
5.  Vercel will automatically detect it as a static site. No framework preset is needed.
6.  Click "**Deploy**". Your site will be live in seconds!
