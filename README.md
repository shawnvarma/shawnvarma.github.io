## Personal Projects Page

I'm interested in AI for medical imaging with a focus on segmentation, classification, and agentic workflows.

Feel free to reach out if you have any questions at varma3211@gmail.com

### Recent Work

- **VLM Scaffold for Craniectomy Localization** - [Project Page](projects/vlm-scaffold-craniectomy/)

  <iframe width="560" height="315" src="https://www.youtube.com/embed/tA66Vf8wKC4?si=tQ7FNQADt4ikd2Nu" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
  Used 3D Slicer controlled by Claude Sonnet 3.5 through MCP to automatically generate multiple 3D model views of a single skull which are each passed to MedGemma/Gemini 2.5 Flash for     independent analysis per view. The multiprompt answers are then combined and counted via majority vote/best-of-N to acheive a 93% accuracy on anatomic side classification   (up from 20% baseline zeroshot)

- **Skull Defect Detection Using Embedding Model** - [Technical Report PDF](projects/skull-defect-detection/assets/images/Skull%20Defect%20Detection%20Using%20CT%20Foundation%20Embeddings.pdf)

  Transfer learning using Google's CT Foundation model embeddings to detect the presence of craniectomies in 3D models derived from CT scans. Model achieved 64% AUC on      binary classification using just 100 sample scan images.

- **Computer Use Agent for Medical Image Analysis**

  <iframe width="560" height="315" src="https://www.youtube.com/embed/3IaLOGeHimc?si=H4zz_pBKlvzXSA-P" title="YouTube video player" frameborder="0" allow="accelerometer;         autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
  
  Created application for generating an initial scan report and anatomy identifier tool built on Claude for Computer Use (Anthropic) and SAM2 (Meta Segment Anything 2).            Developed prompting strategy for multimodal large language model (Claude Sonnet 3.5) and optimized interface considering UI for agent systems. Containerized the agent with Docker on a Windows machine running a Linux environment.    

- **SAM2 Point Based Segmentation for Tumor Segmentation**

  <iframe width="560" height="315" src="https://www.youtube.com/embed/5gOox5fO0mM?si=wfPcT-Sj_pauq4pN" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>

  Designed user interface and created mask propagation script enabling user to scroll through video sequence and improve SAM2 mask with additional selection points. This model was used for video editing tasks and also showed promise in tumor segmentation when the DICOM is loaded in as a video sequence.

- **3D U-Net Cranial Defect Reconstruction**
   
   <iframe width="560" height="315" src="https://www.youtube.com/embed/J0xx4bCd_r4?si=tOuHZ5ltLXMtA8SR&amp;start=1" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
  
  Created proof of concept for automated patient specific implant design in TensorFlow using a 3D U-Net architecture. Used dataset of 200 scans which were artificially edited to represent craniotomy skulls and augmented data to add variation. Built off of open source repository for "A Baseline Approach for the MICCAI 2020 Cranial Implant Design Challenge".
