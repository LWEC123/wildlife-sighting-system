# Limpopo Wildlife Eco College - Wildlife Sighting Data Capture System

A comprehensive digital tool for wildlife sighting data collection, designed specifically for students at Limpopo Wildlife Eco College in South Africa.

## Features

1. **Complete taxonomic hierarchy** with cascading dropdowns (Group → Family → Species) that automatically filter based on previous selections
2. **South African wildlife database** including mammals, birds, reptiles, and amphibians native to South Africa
3. **Temporal data collection** with date picker, time picker, and automatic season calculation for Southern Hemisphere
4. **Spatial referencing** with GPS coordinates (including "Get Current Location" button), habitat zone selection, and distance measurement
5. **Contextual factors** including group size, observed behaviors (multiple selection), and weather conditions
6. **Full data validation** with error messaging for all required fields
7. **Data preview** in both JSON and hierarchical YAML formats
8. **Export functionality** to save records as CSV files

## How Students Can Use This Tool

1. Fill in all the required fields in the form
2. The system validates inputs in real-time, showing any errors
3. After submitting valid data, the system generates a unique Sighting ID
4. Students can view the structured data representation (including the hierarchical format)
5. Data can be exported as CSV for further analysis or record-keeping

## Technical Implementation

- Progressive Web App (PWA) capabilities for offline use in remote field locations
- Responsive design works on mobile devices, tablets, and desktops
- Local storage capability for areas with limited connectivity
- Lightweight implementation focuses on core functionality

## Installation

1. Make sure all the files are in the same directory:
   - index.html
   - manifest.json
   - sw.js
   - icons/ (folder with required icons)
   
2. Host the files on a web server or GitHub Pages:
   - For GitHub Pages: Upload to your repository and enable GitHub Pages
   - Access your site at: https://[username].github.io/[repository-name]/

## South African Wildlife Database

The system includes an extensive database of South African wildlife categorized by:

### Mammals
- Felidae (Lions, Leopards, Cheetahs, etc.)
- Canidae (Jackals, Foxes, Wild Dogs)
- Bovidae (Impalas, Kudus, Wildebeests, Springboks)
- Elephantidae (African Bush Elephant)
- Rhinocerotidae (White and Black Rhinoceros)

### Birds
- Accipitridae (Eagles and Hawks)
- Struthionidae (Ostriches)
- Bucerotidae (Hornbills)
- Phoenicopteridae (Flamingos)
- Psittacidae (Parrots)
- Otididae (Bustards)

### Reptiles
- Crocodylidae (Nile Crocodile)
- Viperidae (Adders)
- Colubridae (Boomslang)
- Testudinidae (Tortoises)

### Amphibians
- Pipidae (African Clawed Frog)
- Bufonidae (Toads)
- Hyperoliidae (Reed Frogs)

## South African Biomes

The habitat selection includes all major South African ecosystems:

- Savanna
- Bushveld
- Fynbos
- Karoo
- Grassland
- Wetland
- Riverine
- Indigenous Forest
- Mountain
- Thicket
- Kalahari Desert

## Offline Usage

The application works offline after the initial load, allowing for use in remote field locations with poor connectivity. Data is stored locally and can be synced when an internet connection becomes available.

## Contributing

Students and faculty of Limpopo Wildlife Eco College are encouraged to suggest improvements or report issues through the college's academic channels.

## License

This project is licensed for educational use by Limpopo Wildlife Eco College.

## Required Icons

For the PWA functionality to work properly, create an "icons" folder and add the following icon sizes:
- icon-72x72.png
- icon-96x96.png
- icon-128x128.png
- icon-144x144.png
- icon-152x152.png
- icon-192x192.png
- icon-384x384.png
- icon-512x512.png
- lwec-logo.png (for the header)
