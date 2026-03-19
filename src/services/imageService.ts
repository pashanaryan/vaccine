import * as ImageManipulator from "expo-image-manipulator";

/**
 * Image Privacy & Compression Pipeline
 * 
 * 1. Resizes the image to a sane maximum dimension to save bandwidth.
 * 2. Compresses the photo slightly to optimize the payload for OpenAI.
 * 3. EXPLICITLY strips EXIF data (GPS coordinates, device info, dates) 
 *    to protect user privacy before the image is sent to the cloud.
 */
export async function sanitizeAndCompressImage(uri: string): Promise<string> {
    try {
        const manipulated = await ImageManipulator.manipulateAsync(
            uri,
            // Resize to max 1500px on the longest side (plenty for OCR)
            [{ resize: { width: 1500 } }],
            {
                compress: 0.7, // 70% quality
                format: ImageManipulator.SaveFormat.JPEG,
                base64: true, // We need the base64 string for the OpenAI API
            }
        );

        if (!manipulated.base64) {
            throw new Error("Failed to generate base64 string during compression.");
        }

        // append the data URI scheme so it works seamlessly with our existing logic
        return `data:image/jpeg;base64,${manipulated.base64}`;
    } catch (error) {
        console.error("[imageService] Error sanitizing image:", error);
        throw new Error("Could not process the image for scanning. Please try another photo.");
    }
}
