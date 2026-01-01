import OpenAI from "openai";
import prisma from '@/lib/prisma';

const openai = new OpenAI();

export default async function handler(req, res) {

    // Get the inputs for the story
    const { mainCharacter, plot, ending, genre, literature } = req.body;
 


    // Replace with your prompt:
    const prompt = `Create a unique and detailed ${literature} between 300 and 400 words that includes the following elements: a main character described as ${mainCharacter}, a plot involving ${plot}, and an ending where ${ending}. The genre of the ${literature} is ${genre}. Ensure that the ${literature} is engaging, with vivid descriptions, in brazilian portuguese and a clear narrative structure that ties together all three components in a creative way.`;
    
    try {
        const messages = [
            { role: "system", content: "You are a creative story writer." },
            { role: "user", content: prompt }
        ];

        // Generate the text with GPT-4o
        // Messages in ChatGPT can have different roles, see the documentation for the available  
        // options: https://platform.openai.com/docs/api-reference/chat/create
        const completion = await openai.chat.completions.create({
            messages: messages,
            model: "gpt-4o",
        });

        const story = completion.choices[0].message.content;

        // Add the generated story to the list of messages
        messages.push(completion.choices[0].message);

        // Now add a message to generate a prompt for generating the illustration
        // messages.push({ role: "user", content: "Now give me a short prompt for an illustration for this story I can provide to DALL-E 3. Output the prompt and no other information." });
           messages.push({ role: "user", content: "Now give me a short prompt for 4 illustrations (Illustration 1 to Text-1, Illustration 2 to Text-2, Illustration 3 to Text-3, and Illustration 4 to Text-4 ) for this story I can provide to DALL-E 3. Output the prompt and no other information." });

        // usar aQUI messages.push({ role: "user", content: "Now give me a short prompt for a diagram with branches and connections I can provide to DALL-E 3. Output the prompt and other information." });


        // and also for a diagram with branches and connections

        // Generate the prompt that describes the illustration we want to generate with DALL-E
        const dallePromptCompletion = await openai.chat.completions.create({
            messages: messages,
            model: "gpt-4o",
        });
        const dallePrompt = dallePromptCompletion.choices[0].message.content;

        // Generate the illustration
        const illustration = await openai.images.generate({ 
            model: "dall-e-3", 
            prompt: dallePrompt,
            response_format: "b64_json"
        });

        const illustrationb64 = illustration.data[0].b64_json;

        // Save the story to the database
        await prisma.story.create({
            data: {
                text: story,
                illustrationb64: illustrationb64
            }
        });
        
        // Return the story and illustration to the UI
        res.status(200).json({ story, illustrationb64 });
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate story' });
    }
}
