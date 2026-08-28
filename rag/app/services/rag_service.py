from app.api.schemas.contracts import CitationResponse, QueryRequest, QueryResponse, SearchRequest, SourceResponse
from app.services.vector_search import VectorSearchService

class RagService:
    def __init__(self, search: VectorSearchService): 
        self._search = search
        from transformers import pipeline
        # Use a small instruction-tuned model for local execution
        self._llm = pipeline("text-generation", model="HuggingFaceTB/SmolLM-135M-Instruct", max_new_tokens=150, truncation=True)

    def answer(self, request: QueryRequest) -> QueryResponse:
        results = self._search.search(SearchRequest(query=request.question, top_k=request.top_k, filters=request.filters)).results
        
        # Strict retrieval gate
        if not results or results[0].relevance < 0.35:
            return QueryResponse(
                answer="Insufficient information found in the available standards knowledge.", 
                sources=[], 
                citations=[], 
                confidence=None, 
                relatedStandards=[], 
                suggestedQuestions=["Try specifying a standard number, product category, or technical requirement."], 
                grounding="insufficient_information"
            )
            
        citations = [CitationResponse(document_id=result.document_id,document_title=result.document_title,page=result.page,section=result.section,clause=result.clause,chunk_id=result.chunk_id,relevance=result.relevance,source=result.source,file_name=result.file_name) for result in results]
        unique_sources: dict[str, SourceResponse] = {}
        for result in results:
            reference = result.source or result.document_id
            unique_sources.setdefault(result.document_id, SourceResponse(title=result.document_title, reference=reference))
            
        # Context assembly
        context = " ".join(result.text for result in results[:3])
        
        # LLM generation
        messages = [
            {"role": "system", "content": "You are a factual AI assistant. Answer the question using ONLY the provided evidence. If the evidence does not contain the answer, reply exactly with 'Insufficient information'."},
            {"role": "user", "content": f"Evidence:\n{context}\n\nQuestion: {request.question}"}
        ]
        llm_response = self._llm(messages, max_new_tokens=150, do_sample=False, repetition_penalty=1.2, return_full_text=False)
        # SmolLM with chat template usually returns the full conversation or the new assistant message.
        # Ensure we parse out just the newly generated text properly.
        if isinstance(llm_response[0]['generated_text'], list):
            # If it's a list of dicts, get the last one
            generated_answer = llm_response[0]['generated_text'][-1]['content'].strip()
        else:
            generated_answer = llm_response[0]['generated_text'].strip()
        
        if "insufficient" in generated_answer.lower():
            return QueryResponse(
                answer="Insufficient information found in the available standards knowledge.", 
                sources=[], 
                citations=[], 
                confidence=None, 
                relatedStandards=[], 
                suggestedQuestions=[], 
                grounding="insufficient_information"
            )

        # Average relevance for confidence mapped from [-1, 1] to [0, 100]
        avg_relevance = sum(result.relevance for result in results) / len(results)
        confidence = round(((avg_relevance + 1) / 2) * 100)
        # Ensure confidence is clamped between 0 and 100
        confidence = max(0, min(100, confidence))
        
        related = list(dict.fromkeys(result.document_title for result in results if result.document_type == "standard"))
        suggestions = ["Which clause should I review next?", "What testing requirements are mentioned in these sources?"]
        
        return QueryResponse(
            answer=f"{generated_answer}\n\nReview the cited source before relying on it for compliance decisions.",
            sources=list(unique_sources.values()),
            citations=citations,
            confidence=confidence,
            relatedStandards=related,
            suggestedQuestions=suggestions,
            grounding="supported" if confidence >= 45 else "partially_supported"
        )
