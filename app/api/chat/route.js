import { NextResponse } from "next/server";
import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { randomProjection } from './dimensionReduction';

const TARGET_DIMENSION = 93;

const systemPrompt = `
You are a helpful assistant for a 'Rate My Professor' system designed to assist students in finding the best professors according to their needs. Your job is to provide the top 3 professor recommendations based on the user's query, using a combination of existing professor ratings, student reviews, and relevant metadata.

When a student asks a question, you should:

1. Interpret the Query: Understand the user's intent, which may include preferences such as subject expertise, teaching style, student satisfaction, or overall rating.

2. Search and Retrieve Information: Utilize the available database (or index) of professor profiles, including their ratings, reviews, subjects taught, and other relevant attributes.

3. Generate a Response:
   - Provide the top 3 professors that best match the user's query.
   - For each professor, include the following information:
     - Name of the professor (use the exact name provided in the "Professor Name" field).
     - Department or subject area.
     - Average rating (e.g., out of 5 stars).
     - A brief summary of what makes this professor a good match based on the query.
     - Any relevant highlights from student reviews.

4. Ensure Accuracy and Relevance: Always aim to provide the most accurate and relevant recommendations, considering factors like recent reviews, consistent high ratings, and alignment with the student's needs.

Respond with a polite and informative tone, keeping the student's needs in mind, and always ensure the information provided is up-to-date and accurate. Do not refer to professors by numbers or IDs; always use their full names as provided in the "Professor Name" field.`;


export async function POST(req) {
    try {
        const data = await req.json();
        console.log("Received data:", JSON.stringify(data, null, 2));

        const pc = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY,
        });
        const index = pc.index('rag');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

        const text = data[data.length - 1].content;
        console.log("Processing text:", text);

        // Use Gemini to generate embeddings
        const embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });
        const embeddingResult = await embeddingModel.embedContent(text);
        console.log("Raw embedding result:", JSON.stringify(embeddingResult, null, 2));

        let embedding = extractEmbedding(embeddingResult);
        console.log("Original embedding dimension:", embedding.length);

        // Reduce dimensionality
        embedding = randomProjection(embedding, TARGET_DIMENSION);
        console.log("Reduced embedding dimension:", embedding.length);

        const results = await index.query({
            vector: embedding,
            topK: 3,
            includeMetadata: true,
        });

        console.log("Pinecone query results:", JSON.stringify(results, null, 2));

        let resultString = '\n\nReturned results from vector db:';
        results.matches.forEach((match) => {
            resultString += `\n
            Professor Name: ${match.metadata.professor}
            Subject: ${match.metadata.subject}
            Stars: ${match.metadata.stars}
            Review: ${match.metadata.review}
            \n
            `;
        });

        const lastMessage = data[data.length - 1];
        const lastMessageContent = lastMessage.content + resultString;
        const lastDataWithoutLastMessage = data.slice(0, data.length - 1);

        // Use Gemini for chat completion
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        
        const chat = model.startChat({
            history: [
                {
                    role: "user",
                    parts: [{ text: systemPrompt }],
                },
                ...lastDataWithoutLastMessage.map(msg => ({
                    role: msg.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: msg.content }],
                })),
            ],
        });

        const result = await chat.sendMessage(lastMessageContent);

        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();
                try {
                    const text = encoder.encode(result.response.text());
                    controller.enqueue(text);
                } catch (err) {
                    console.error("Streaming error:", err);
                    controller.error(err);
                } finally {
                    controller.close();
                }
            }
        });

return new NextResponse(stream);

    } catch (error) {
        console.error("Error in POST route:", error);
        return new NextResponse(JSON.stringify({ error: error.message, stack: error.stack }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

function extractEmbedding(embeddingResult) {
    if (Array.isArray(embeddingResult) && embeddingResult.every(item => typeof item === 'number')) {
        return embeddingResult;
    }
    if (typeof embeddingResult === 'object' && embeddingResult !== null) {
        for (let key in embeddingResult) {
            const result = extractEmbedding(embeddingResult[key]);
            if (result) return result;
        }
    }
    throw new Error("Could not extract embedding array from the result");
}