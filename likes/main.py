from fastapi import FastAPI
from typing import List
import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import pickle

app = FastAPI()

# Load the pre-trained model and vectorizer
with open('cosine_similarity.pkl', 'rb') as file:
    cosine_sim = pickle.load(file)

with open('vectorizer.pkl', 'rb') as file:
    vectorizer = pickle.load(file)

# Load the dataframe
df = pd.read_csv('Place Detail (Scored + Keyword 1 & 2 Extracted  + Additional Feature (longlang, contact etc)) + (finished Vectorized).csv')

# API route to get recommendations
@app.get("/recommendations/{item_title}")
# Function to get recommendations
def get_recommendations(item_title: str) -> List[dict]:
    top_n: int = 10
    item_index = df[df['Name'] == item_title].index[0]
    similarity_scores = list(enumerate(cosine_sim[item_index]))
    similarity_scores = sorted(similarity_scores, key=lambda x: x[1], reverse=True)
    top_items = similarity_scores[1:top_n + 1]
    top_item_indices = [i[0] for i in top_items]
    top_item_data = df.iloc[top_item_indices].reset_index(drop=True)

    recommendations = []
    for _, row in top_item_data.iterrows():
        recommendation = {
            'name': row['Name'],
            'address': row['Formatted Address'],
            'rating': row['rating'],
            'total_review': row['total_reviews'],
            'url_photo': row.get('Photo URL', 'N/A')
        }
        recommendations.append(recommendation)
    return recommendations

# Main function to run the API
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)