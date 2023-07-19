import csv
import re
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
import nltk
from nltk.corpus import stopwords
from fastapi import FastAPI, Request, Response, status
from pydantic import BaseModel
from typing import List, Dict
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import pickle

nltk.download('stopwords')

app = FastAPI()

#loaded_function = pickle.load(open('C:.\model\results.pkl', 'rb'))
with open('./model/results.pkl', 'rb') as file:
    loaded_object = pickle.load(file)

with open('./model/cosine_similarity.pkl', 'rb') as file:
    cosine_sim = pickle.load(file)

with open('./model/vectorizer.pkl', 'rb') as file:
    vectorizer = pickle.load(file)

# Load the dataframe
df = pd.read_csv('./dataset/Place Detail (Scored + Keyword 1 & 2 Extracted  + Additional Feature (longlang, contact etc)) + (finished Vectorized).csv')
default_file_path = './dataset/Place Detail (Scored + Keyword 1 & 2 Extracted  + Additional Feature (longlang, contact etc)) (1).csv'  # Set your default file path here


embeddings_index = {}
with open('glove.6B.100d.txt', 'r', errors="ignore") as f:
    for line in f:
        values = line.split(" ")
        word = values[0]
        coefs = np.asarray(values[1:], dtype='float32')
        embeddings_index[word] = coefs

embedding_dim = 100  # Dimensionality of the word embeddings
embedding_matrix = np.zeros((len(embeddings_index), embedding_dim))
vocab = []

for i, word in enumerate(embeddings_index):
    embedding_vector = embeddings_index[word]
    embedding_matrix[i] = embedding_vector
    vocab.append(word)

search_data = []
for word in vocab:
    search_data.append(embeddings_index[word])

search_data = np.array(search_data)

class SearchRequest(BaseModel):
    user_input: str

class ItemTittle(BaseModel):
    tittle: str

class CafeDetailsResponse(BaseModel):
    message: str
    cafe_details: List[Dict[str, str]]

class RecommendationsDetailsResponse(BaseModel):
    message: str
    recommendations_details: List[Dict[str, str]]

class SearchDetailsResponse(BaseModel):
    message: str
    search_details: List[Dict[str, str]]

def get_recommendations(name_coffee) -> List[Dict]:
    top_n: int = 20
    item_index = df[df['Name'] == name_coffee].index[0]
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

def details(query, file_path):
    with open(file_path, 'r', encoding='utf-8') as file:
        csv_reader = csv.DictReader(file)
        found_rows = []
        for row in csv_reader:
            if query in row.values():
                found_rows.append({
                    'name': row['Name'],
                    'address': row['Formatted Address'],
                    'rating': row['rating'],
                    'total_review': row['total_reviews'],
                    'url_photo': row.get('Photo URL', 'N/A'),
                    'place_id': row.get('Place ID'),
                    'place_url': row.get('Place URL'),
                    'contact': row.get('Contact'),
                    'longitude': row.get('Longitude'),
                    'latitude': row.get('Latitude')
                })
    return found_rows


def perform_search(user_input):
    def search(query, top_k=20):
        top_words_list = []
        for query_word in query:
            query_tokens = query_word.split()
            query_embedding = np.mean([embeddings_index[token] for token in query_tokens if token in embeddings_index], axis=0)
            similarity_scores = cosine_similarity([query_embedding], search_data)
            similarity_scores = similarity_scores.reshape(-1)
            top_indices = similarity_scores.argsort()[-top_k:][::-1]
            top_words = [vocab[i] for i in top_indices]
            top_words_list.append(top_words)
        return top_words_list

    def input_keyword(user_input):
        stop_words = set(stopwords.words('english'))

        additional_keywords = ["caffe", "place", "coffee", "nan", "cafe"]

        words = user_input.split()

        search_keywords = re.findall(r'\b\w+\b', user_input.lower())

        search_keywords = [word for word in search_keywords if word not in stop_words and word not in additional_keywords]

        return search_keywords

    result = input_keyword(user_input)

    top_words_list = search(result, top_k=10)

    list_of_words = []
    for i, query_word in enumerate(result):
        list_of_words.append(top_words_list[i])
    list_of_words = [word for sublist in list_of_words for word in sublist]

    def search_keywords(csv_file, keywords, column):
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            rows = [row for row in reader]

        row_numbers = []
        for row in rows:
            for keyword in keywords:
                if keyword in row[column]:
                    row_numbers.append(rows.index(row))

        return row_numbers

    csv_file = './dataset/Place Detail (Scored + Keyword 1 & 2 Extracted  + Additional Feature (longlang, contact etc)) (1).csv'
    keywords = list_of_words
    column = 13

    row_numbers = search_keywords(csv_file, keywords, column)
    unique_list = list(set(row_numbers))
    sorted_list = sorted(unique_list)
    Place_list = sorted_list[:20]

    def caffe_result(Place_list):
        columns_to_extract = [1, 0, 2, 4, 5, 14, 15, 16]
        output = []

        with open(csv_file, 'r', encoding='utf-8') as file:
            reader = csv.reader(file)
            next(reader)  # Skip the header row

            def get_data(row_numbers, column_numbers):
                data = []
                for i, row in enumerate(reader):
                    if i + 1 in row_numbers:
                        row_data = [row[col] for col in column_numbers]
                        data.append(row_data)
                return data

            data = get_data(Place_list, columns_to_extract)
            for row in data:
                output.append({
                    "place_id": row[0],
                    "name": row[1],
                    "address": row[2],
                    "rating": float(row[3]),
                    "total_review": int(row[4]),
                    "url_photo": row[5],
                    "longitude": row[6],
                    "latitude": row[7]
                })

        return output

    return caffe_result(Place_list)

@app.get("/")
def read_root():
    return {"Hello": "World"}

@app.get("/caffe")
def data(request: Request, response: Response):
    response.status_code = status.HTTP_200_OK
    return {
        "message": "Recommendations cafe is successfully loaded.",
        "cafe": loaded_object
    }

@app.get("/caffe/details/{query}", response_model=CafeDetailsResponse)
def caffe_details(query: str) -> CafeDetailsResponse:
    results = details(query, default_file_path)
    return CafeDetailsResponse(
        message="This is detail about the cafe.",
        cafe_details=results
    )

@app.post("/recommendations")
# Function to get recommendations
def recommendations(caffe: ItemTittle, request: Request, response: Response):
    name_coffee = caffe.tittle

    if not name_coffee:
        response.status_code = status.HTTP_400_BAD_REQUEST
        return {"error": "Missing 'title' in the request body."}

    # Perform the recommendations
    advice = get_recommendations(name_coffee)
    if advice:
        return {
            "message": "Recommendations retrieved successfully.",
            "recommendations": advice
        }
    else:
        response.status_code = status.HTTP_404_NOT_FOUND
        return {"error": "No recommendations found for the provided item title."}

@app.get("/recommendations/details/{query}", response_model=RecommendationsDetailsResponse)
def recommendations_details(query: str) -> RecommendationsDetailsResponse:
    results = details(query, default_file_path)
    return RecommendationsDetailsResponse(
        message="This is detail about the cafe.",
        recommendations_details=results
    )


@app.post('/search')
def search(search: SearchRequest, request: Request, response: Response):
    user_input = search.user_input
    # Perform the search
    results = perform_search(user_input)
    if results:
        return {
            "message": "Search success.",
            "search": results
        }
    else:
        response.status_code = status.HTTP_404_NOT_FOUND
        return {"error": "No search found for the provided item title."}

@app.get("/search/details/{query}", response_model=SearchDetailsResponse)
def search_details(query: str) -> SearchDetailsResponse:
    results = details(query, default_file_path)
    return SearchDetailsResponse(
        message="This is detail about the cafe.",
        search_details=results
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
