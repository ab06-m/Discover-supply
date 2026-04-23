const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const INPUT_DIR = path.join(__dirname, '../kyte_images');
const OUTPUT_DIR = path.join(__dirname, '../kyte_images_optimized');

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Crisp up soft edges without AI hallucination
const SHARPEN_OPTIONS = {
    sigma: 1.5,
    m1: 1,
    m2: 2,
    x1: 2,
    y2: 10,
    y3: 20
};

async function processImages() {
    console.log(`Starting standard image optimization pipeline...`);
    
    if (!fs.existsSync(INPUT_DIR)) {
        console.error("Input directory not found."); return;
    }
    
    const files = fs.readdirSync(INPUT_DIR).filter(file => {
        return ['.jpg', '.jpeg', '.png', '.webp'].includes(path.extname(file).toLowerCase());
    });

    console.log(`Found ${files.length} native images to process. Formatting to 1000x1000 WebP.`);

    let successCount = 0;
    let failCount = 0;

    for (const [index, file] of files.entries()) {
        const inputPath = path.join(INPUT_DIR, file);
        const baseName = path.parse(file).name;
        const outputPath = path.join(OUTPUT_DIR, `${baseName}.webp`);

        try {
            await sharp(inputPath)
                .resize({
                    width: 1000,
                    height: 1000,
                    fit: 'contain', 
                    background: { r: 255, g: 255, b: 255, alpha: 1 }
                })
                .sharpen(SHARPEN_OPTIONS)     
                .webp({ effort: 6, quality: 90 }) 
                .toFile(outputPath);

            successCount++;
            process.stdout.write(`\rProgress: ${index + 1}/${files.length} (Success: ${successCount})`);
        } catch (error) {
            failCount++;
            console.error(`\nFailed to process ${file}:`, error.message);
        }
    }

    console.log(`\n\nOptimization Complete! Saved to: ${OUTPUT_DIR}`);
}

processImages().catch(console.error);
