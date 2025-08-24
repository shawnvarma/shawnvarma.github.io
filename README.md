## Personal Projects Page

I'm interested in AI for medical imaging with a focus on segmentation, classification, and agentic workflows.

Feel free to reach out if you have any questions at varma3211@gmail.com

### Recent Projects

- [Skull Defect Detection.pdf](projects/skull-defect-detection/assets/images/Skull%20Defect%20Detection%20Using%20CT%20Foundation%20Embeddings.pdf)

  Transfer learning using Google's CT Foundation model embeddings to detect the presence of craniectomy presence in 3D models derived from CT scans. Model achieved 64% AUC on      binary classification using just 100 sample scan images.
- [VLM Scaffold for Skull Void Detection using MedGemma and Gemini 2.5 Flash](/projects/project-beta.md)

  <iframe width="560" height="315" src="https://www.youtube.com/embed/tA66Vf8wKC4?si=tQ7FNQADt4ikd2Nu" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
  Used 3D Slicer controlled by Claude Sonnet 3.7 through MCP to automatically generate multiple 3D model views of skull which are each passed to MedGemma/Gemini 2.5 Flash for      independent analysis per view. The multiprompt answers are then combined and counted via majority vote/best-of-N to acheive a 93% accuracy rate on anatomic side classification   (up from 20% baseline zeroshot)
- [Project Gamma](/projects/project-gamma.md)
