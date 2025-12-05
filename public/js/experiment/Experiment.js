/**
 * Image Valuation Experiment - Main Class
 * Core experiment class definition with constructor and initialization
 */

class ImageValuationExperiment {
    constructor() {
        this.currentPhase = 1;
        this.currentImageIndex = 0;
        this.phase1Images = [];
        this.phase2Images = [];
        this.attentionCheckCounter = 0;
        this.csvData = [];
        this.experimentConfig = null;
        this.attentionCheckQuestions = null;
        this.subjectId = null;

        // Phase 1 state
        this.phase1StartTime = null;
        this.imageDisplayStartTime = null;
        
        // Phase 2 state  
        this.phase2StartTime = null;
        this.currentMemoryResponse = null;
        this.currentPaymentResponse = null;
        this.currentConfidence = null;
        this.sliderInteracted = false;
        this.imageQuestionStartTime = null;
        
        // Attention check state
        this.attentionCheckStartTime = null;
        
        // Final questions state
        this.finalAnswers = {};
        
        // Session tracking
        this.sessionId = `ses_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.sessionStartTime = new Date().toISOString();
        
        // Image preloading
        this.preloadedImages = {};
        this.imagesLoaded = false;
        
        // Phase 1 size tracking for Phase 2 analysis
        this.phase1ImageSizes = new Map(); // Maps image.id to size ('large' or 'small')
        
        console.log(`Experiment initialized with session ID: ${this.sessionId}`);
    }

    async init() {
        try {
            console.log('Loading experiment configuration...');
            const response = await fetch('/config.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const config = await response.json();
            this.experimentConfig = config.experimentConfig;
            this.attentionCheckQuestions = config.attentionCheckQuestions;
            
            console.log('Configuration loaded successfully:', {
                phase1Images: this.experimentConfig.phase1Images,
                phase2Images: this.experimentConfig.phase2Images,
                attentionChecks: this.experimentConfig.attentionChecks,
                questionsAvailable: this.attentionCheckQuestions.length
            });
            
            this.generateImageArrays();
            this.showWelcomePage();
        } catch (error) {
            console.error("Could not load experiment configuration:", error);
            this.showError("Could not load experiment configuration. Please contact the researcher.");
        }
    }

    generateImageArrays() {
        const phase1Config = this.experimentConfig.phase1;
        const phase2Config = this.experimentConfig.phase2;
        
        // Phase 1: Random selection from old-images with size distribution
        this.phase1Images = [];
        const oldImageFiles = this.getImageFilesFromFolder('old-images');
        const shuffledOldImages = this.shuffleArray([...oldImageFiles]);
        
        // Create large images
        for (let i = 0; i < phase1Config.largeCount; i++) {
            this.phase1Images.push({
                id: i + 1,
                filename: shuffledOldImages[i],
                size: 'large',
                phase: 1,
                originalIndex: i
            });
        }
        
        // Create small images
        for (let i = 0; i < phase1Config.smallCount; i++) {
            this.phase1Images.push({
                id: phase1Config.largeCount + i + 1,
                filename: shuffledOldImages[phase1Config.largeCount + i],
                size: 'small',
                phase: 1,
                originalIndex: phase1Config.largeCount + i
            });
        }
        
        // Shuffle Phase 1 images to mix large and small randomly
        this.phase1Images = this.shuffleArray([...this.phase1Images]);
        
        // Phase 2: Equal amounts of old images (from Phase 1) + new images, all medium size
        this.phase2Images = [];
        
        // Add old images from Phase 1 (all medium size)
        const phase1SelectedImages = [...this.phase1Images];
        for (let i = 0; i < phase2Config.oldImagesCount; i++) {
            this.phase2Images.push({
                ...phase1SelectedImages[i],
                size: 'medium', // Override size to medium for Phase 2
                phase: 2,
                isOld: true
            });
        }
        
        // Add new images from new-images folder (all medium size)
        const newImageFiles = this.getImageFilesFromFolder('new-images');
        const shuffledNewImages = this.shuffleArray([...newImageFiles]);
        
        // Calculate the next available ID after phase1 images
        const nextAvailableId = Math.max(...this.phase1Images.map(img => img.id)) + 1;
        
        for (let i = 0; i < phase2Config.newImagesCount; i++) {
            this.phase2Images.push({
                id: nextAvailableId + i,
                filename: shuffledNewImages[i],
                size: 'medium',
                phase: 2,
                isOld: false
            });
        }
        
        // Shuffle Phase 2 images
        this.phase2Images = this.shuffleArray([...this.phase2Images]);
        
        const phase1Total = phase1Config.largeCount + phase1Config.smallCount;
        const phase2Total = phase2Config.oldImagesCount + phase2Config.newImagesCount;
        console.log(`Generated ${this.phase1Images.length} Phase 1 images (${phase1Config.largeCount} large, ${phase1Config.smallCount} small) and ${this.phase2Images.length} Phase 2 images (${phase2Config.oldImagesCount} old, ${phase2Config.newImagesCount} new, all medium)`);
        console.log('Phase 1 images:', this.phase1Images.map(img => `${img.filename}(${img.size})`));
        console.log('Phase 2 images:', this.phase2Images.map(img => `${img.filename}(${img.isOld ? 'old' : 'new'})`));
    }

    getImageFilesFromFolder(folderName) {
        // Use the shared image lists to ensure test and experiment are synchronized
        return window.getImagesForDirectory(folderName) || [];
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    showError(message) {
        document.body.innerHTML = `
            <div class="main-container">
                <div class="instructions">
                    <h2>Error</h2>
                    <div style="border: 1px solid #e5e5e5; padding: 2rem; border-radius: 4px; margin: 2rem 0; background: #fafafa; color: red;">
                        <p>${message}</p>
                        <div style="margin-top: 1rem; color: #666; font-size: 12px;">
                            <small>Session ID: ${this.sessionId}</small>
                        </div>
                    </div>
                </div>
            </div>`;
    }

    async preloadImages() {
        // Show loading screen
        this.showLoadingScreen();
        
        try {
            console.log('Starting image preloading...');
            
            // Collect all unique image paths that will be used in the experiment
            const imagesToPreload = new Set();
            
            // Add Phase 1 images
            this.phase1Images.forEach(img => {
                imagesToPreload.add(`images/old-images/${encodeURIComponent(img.filename)}`);
            });
            
            // Add Phase 2 images
            this.phase2Images.forEach(img => {
                const folder = img.isOld ? 'old-images' : 'new-images';
                imagesToPreload.add(`images/${folder}/${encodeURIComponent(img.filename)}`);
            });
            
            const imagePathsArray = Array.from(imagesToPreload);
            const totalImages = imagePathsArray.length;
            let loadedCount = 0;
            
            console.log(`Preloading ${totalImages} images...`);
            
            // Create promises for all image loads
            const loadPromises = imagePathsArray.map((imagePath, index) => {
                return new Promise((resolve, reject) => {
                    const img = new Image();
                    
                    img.onload = () => {
                        this.preloadedImages[imagePath] = img;
                        loadedCount++;
                        
                        // Update progress
                        const progress = Math.round((loadedCount / totalImages) * 100);
                        this.updateLoadingProgress(progress, loadedCount, totalImages);
                        
                        resolve(img);
                    };
                    
                    img.onerror = () => {
                        console.warn(`Failed to load image: ${imagePath}`);
                        loadedCount++;
                        
                        // Still update progress even for failed images
                        const progress = Math.round((loadedCount / totalImages) * 100);
                        this.updateLoadingProgress(progress, loadedCount, totalImages);
                        
                        resolve(null); // Resolve with null instead of rejecting
                    };
                    
                    img.src = imagePath;
                });
            });
            
            // Wait for all images to load (or fail)
            await Promise.all(loadPromises);
            
            this.imagesLoaded = true;
            console.log(`Image preloading completed. ${Object.keys(this.preloadedImages).length} images loaded successfully.`);
            
            // Show completion message briefly before continuing
            this.showLoadingComplete();
            
            // Wait a moment to show completion, then proceed
            setTimeout(() => {
                this.showPhase1Instructions();
            }, 1000);
            
        } catch (error) {
            console.error('Error during image preloading:', error);
            this.showError('Failed to load images. Please refresh the page and try again.');
        }
    }

    showLoadingScreen() {
        document.body.innerHTML = `
            <div class="main-container">
                <div class="instructions">
                    <h2>Loading Images</h2>
                    <div style="border: 1px solid #e5e5e5; padding: 2rem; border-radius: 4px; margin: 2rem 0; background: #fafafa;">
                        <p style="font-size: 18px; margin-bottom: 1rem;">
                            Please wait while we load the experiment images...
                        </p>
                        <div style="width: 100%; background-color: #e5e5e5; border-radius: 10px; overflow: hidden; margin: 1rem 0;">
                            <div id="progressBar" style="width: 0%; height: 20px; background-color: #1976d2; transition: width 0.3s ease-in-out;"></div>
                        </div>
                        <div id="progressText" style="text-align: center; color: #666; font-size: 14px;">
                            Loading images... 0% (0/0)
                        </div>
                    </div>
                    <p style="color: #888; font-size: 14px;">This may take a moment depending on your internet connection.</p>
                </div>
            </div>`;
    }

    updateLoadingProgress(progress, loaded, total) {
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }
        
        if (progressText) {
            progressText.textContent = `Loading images... ${progress}% (${loaded}/${total})`;
        }
    }

    showLoadingComplete() {
        const progressText = document.getElementById('progressText');
        if (progressText) {
            progressText.textContent = '✓ All images loaded successfully!';
            progressText.style.color = '#2e7d32';
            progressText.style.fontWeight = 'bold';
        }
    }

    // Method to get preloaded image or fallback to regular loading
    getImageElement(imagePath, alt = '', style = '') {
        if (this.preloadedImages[imagePath]) {
            // Clone the preloaded image
            const img = this.preloadedImages[imagePath].cloneNode();
            img.alt = alt;
            if (style) {
                img.style.cssText = style;
            }
            return img.outerHTML;
        } else {
            // Fallback to regular image loading with error handling
            return `<img src="${imagePath}" alt="${alt}" style="${style}" 
                         onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4gPHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2Y1ZjVmNSIvPiA8dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iMC4zZW0iPkltYWdlIEVycm9yPC90ZXh0PiA8L3N2Zz4=';">`;
        }
    }
} 