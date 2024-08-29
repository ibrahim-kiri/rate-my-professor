import { NextResponse } from "next/server";
import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from "@google/generative-ai";

const systemPrompt = `
You are a helpful assistant for a 'Rate My Professor' system designed to assist students in finding the best professors according to their needs. Your job is to provide the top 3 professor recommendations based on the user's query, using a combination of existing professor ratings, student reviews, and relevant metadata.

When a student asks a question, you should:

Interpret the Query: Understand the user's intent, which may include preferences such as subject expertise, teaching style, student satisfaction, or overall rating.

Search and Retrieve Information: Utilize the available database (or index) of professor profiles, including their ratings, reviews, subjects taught, and other relevant attributes.

Generate a Response:

Provide the top 3 professors that best match the user's query.
For each professor, include the following information:
Name of the professor.
Department or subject area.
Average rating (e.g., out of 5 stars).
A brief summary of what makes this professor a good match based on the query.
Any relevant highlights from student reviews.
Ensure Accuracy and Relevance: Always aim to provide the most accurate and relevant recommendations, considering factors like recent reviews, consistent high ratings, and alignment with the student's needs.

Respond with a polite and informative tone, keeping the student's needs in mind, and always ensure the information provided is up-to-date and accurate.`

export async function POST(req) {
    try {
        const data = await req.json();
        console.log("Received data:", JSON.stringify(data, null, 2));

        const pc = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY,
            // environment: process.env.PINECONE_ENVIRONMENT
        });
        const index = pc.index('rag');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

        const text = data[data.length - 1].content;
        console.log("Processing text:", text);

        // Use Gemini to generate embeddings
        const embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });
        const embeddingResult = await embeddingModel.embedContent(text);
        console.log("Raw embedding result:", JSON.stringify(embeddingResult, null, 2));

        let embedding;
        if (Array.isArray(embeddingResult)) {
            embedding = embeddingResult;
        } else if (typeof embeddingResult === 'object') {
            // Try to find an array in the object
            const arrayProperty = Object.values(embeddingResult).find(Array.isArray);
            if (arrayProperty) {
                embedding = arrayProperty;
            } else {
                console.error("Could not find an array in the embedding result");
                throw new Error("Embedding result does not contain an array");
            }
        } else {
            console.error("Unexpected embedding result type:", typeof embeddingResult);
            throw new Error("Failed to generate embedding: Unexpected result type");
        }

        if (!Array.isArray(embedding)) {
            console.error("Embedding is not an array:", embedding);
            throw new Error("Embedding is not in the expected format");
        }

        console.log("Extracted embedding (first 5 values):", embedding.slice(0, 5));

        const results = await index.query({
            vector: embedding,
            topK: 3,
            includeMetadata: true,
        });

        console.log("Pinecone query results:", JSON.stringify(results, null, 2));

        let resultString = '\n\nReturned results from vector db:';
        results.matches.forEach((match) => {
            resultString += `\n
            Professor: ${match.id}
            Review: ${match.metadata.review}
            Subject: ${match.metadata.subject}
            Stars: ${match.metadata.stars}
            \n\n
            `;
        });

        const lastMessage = data[data.length - 1];
        const lastMessageContent = lastMessage.content + resultString;
        const lastDataWithoutLastMessage = data.slice(0, data.length - 1);

        // Use Gemini for chat completion
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        
        const chat = model.startChat({
            history: [
                { role: "user", parts: systemPrompt },
                ...lastDataWithoutLastMessage.map(msg => ({ role: msg.role, parts: msg.content })),
            ],
        });

        const result = await chat.sendMessageStream(lastMessageContent);

        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();
                try {
                    for await (const chunk of result.stream) {
                        const text = encoder.encode(chunk.text());
                        controller.enqueue(text);
                    }
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