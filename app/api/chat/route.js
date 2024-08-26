import { NextResponse } from "next/server";
import { Pinecone } from '@pinecone-database/pinecone'
import OpenAI from 'openai'

const systemPrompt = 
`
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

Example:
If a student asks for the best professor in the Computer Science department who is known for their clear explanations, provide recommendations such as:

Professor John Doe
Department: Computer Science
Rating: 4.8/5
Summary: Known for his exceptional clarity in teaching complex algorithms and data structures. Students frequently praise his ability to break down difficult topics into easily understandable parts.
Review Highlight: "Professor Doe makes even the toughest subjects seem easy to grasp. His clear and structured teaching style is unmatched."
Respond with a polite and informative tone, keeping the student's needs in mind, and always ensure the information provided is up-to-date and accurate."
`

export async function POST(req) {
    const data = await req.json()
    const pc = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY,
    })
    const index = pc.index('rag').namespace('ns1')
    const openai = new OpenAI()

    const text = data[data.length - 1].content
    const embedding = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
        encoding_format: 'float',
    })

    const results = await index.query({
        topK: 3,
        includeMetadata: true,
        vector: embedding.data[0],embedding
    })

    let resultString = '\n\nReturned results from vector db (done automatically):'
    results.matches.forEach((match) => {
        resultString += `\n
        Professor: ${match.id}
        Review: ${match.metadata.stars}
        Subject: ${match.metadata.subject}
        Stars: ${match.metadata.stars}
        \n\n
        `
    })

    const lastMessage = data[data.length - 1]
    const lastMessageContent = lastMessage.content + resultString
    const lastDataWithoutLastMessage = data.slice(0, data.length - 1)
    const completion = await openai.chat.completions.create({
        messages: [
            {role: 'system', content: systemPrompt},
            ...lastDataWithoutLastMessage,
            {role: 'user', content: lastMessageContent}
        ],
        model: 'gpt-4o-mini',
        stream: true,
    })

    const stream = new ReadableStream({
        async start(controller){
            const encoder = new TextEncoder()
            try{
                for await (const chunk of completion) {
                    const content = chunk.choices[0]?.delta?.content
                    if (content) {
                        const text = encoder.encode(content)
                        controller.enqueue(text)
                    }
                }
            } catch (err) {
                controller.error(err)
            } finally {
                controller.close()
            }
        }
    })

    return new NextResponse(stream)
}