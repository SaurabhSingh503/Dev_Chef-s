#!/bin/bash
# MANAK Dataset Loading Script
# Setup script to extract datasets for the application.

# Default to ../Datasets-manak.zip if no argument is provided
DATASET_ZIP="${1:-../Datasets-manak.zip}"
PROJECT_DATASETS_DIR="$(pwd)/Datasets"

echo "Looking for dataset archive at: $DATASET_ZIP"

if [ ! -f "$DATASET_ZIP" ]; then
    echo "ERROR: Datasets-manak.zip not found at $DATASET_ZIP"
    echo "Please download the MANAK dataset and place it in the parent directory, or provide the path as an argument:"
    echo "./setup_datasets.sh /path/to/Datasets-manak.zip"
    exit 1
fi

echo "Archive found! Extracting to $PROJECT_DATASETS_DIR..."
# The backend express server in backend/src/app.ts explicitly serves static PDFs
# from '../Datasets', meaning it depends on the directory being extracted at MANAK/Datasets.
mkdir -p "$PROJECT_DATASETS_DIR"
unzip -o -q "$DATASET_ZIP" -d "$PROJECT_DATASETS_DIR"

echo "Dataset extracted successfully. The backend will serve PDFs from this directory."
