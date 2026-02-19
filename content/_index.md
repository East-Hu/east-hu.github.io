---
title: ''
summary: ''
date: 2022-10-24
type: landing

design:
  spacing: '6rem'

sections:
  - block: resume-biography-3
    content:
      username: me
      text: ''
      button:
        text: Download CV
        url: uploads/resume.pdf
      headings:
        about: ''
        education: ''
        interests: ''
    design:
      background:
        gradient_mesh:
          enable: true
      name:
        size: md
      avatar:
        size: medium
        shape: circle

  - block: markdown
    content:
      title: '🖥️ Research Interests'
      subtitle: ''
      text: |-
        - **LLM Security & Privacy** - Exploring vulnerabilities and defense mechanisms in large language models
        - **Trustworthy AI** - Building reliable and safe AI systems
        - **3D Vision/Reconstruction** - Computer vision applications in 3D understanding
        - **Federated Learning** - Distributed machine learning with privacy preservation
    design:
      columns: '1'

  - block: markdown
    id: news
    content:
      title: '📰 Latest News'
      subtitle: ''
      text: |-
        - **May 2026**: Started Ph.D program at University of Georgia under Prof. Jian Liu!
        - **May 2026**: Graduated from Georgia State University with M.S. in Computer Science (GPA: 4.0/4.0)!
        - **January 2026**: One paper (GAMBIT) was submitted to ACL 2026!
        - **September 2025**: One paper (BHFL) was submitted to IEEE Internet of Things Journal!
        - **June 2025**: Joined INSPIRE Lab at GSU as Ph.D student.
        - **January 2025**: Started M.S. program at Georgia State University.
        - **June 2024**: Completed Bachelor's degree and graduated from NingboTech University.
        - **Sep – Dec 2023**: Research internship at Zhejiang Lab on 3D character reconstruction (NOVA-3D).
    design:
      columns: '1'

  - block: markdown
    id: research
    content:
      title: '🔬 Research Experience'
      subtitle: ''
      text: |-
        ### GAMBIT: Gamified Jailbreak Framework for Multimodal LLMs
        *Georgia State University, INSPIRE Lab | Jun 2025 - Present*
        - Proposed a novel framework utilizing 'Puzzle-based Multimodal Encoding' to disrupt visual semantic filters
        - Identified and formalized the 'Safety-Complexity Trade-off' in Multimodal LLMs
        - Achieved state-of-the-art Attack Success Rates (ASR) on popular models
        - **Submitted to ACL 2026** | [arXiv](https://arxiv.org/)

        ### Straggler Mitigation in Blockchain-based Hierarchical Federated Learning
        *Georgia State University, INSPIRE Lab | Jun 2025 - Present*
        - Proposed a decentralized BHFL framework utilizing Raft-based consortium blockchain
        - Designed 'HieAvg', a novel hierarchical averaging algorithm with theoretical convergence proof
        - Validated performance improvements on Raspberry Pi and AWS EC2 testbeds
        - **Submitted to IEEE Internet of Things Journal** | [arXiv](https://arxiv.org/)

        ### NOVA-3D: Non-overlapped Views for 3D Anime Character Reconstruction
        *Zhejiang Lab, AI Research Institute | Sep 2023 - Dec 2023*
        - Contributed to a framework synthesizing full-body 3D anime characters from dual viewpoints
        - Assisted in implementing a Direction-aware Attention Module to resolve 'ghost face' artifacts
        - **Published on arXiv** | [Paper](https://arxiv.org/)
    design:
      columns: '1'

  - block: markdown
    id: projects
    content:
      title: '💻 Open Source Projects'
      subtitle: ''
      text: |-
        ### PaperSeek: Agentic Research Assistant
        *Nov 2025 - Present* | [GitHub](https://github.com/East-Hu)
        - Designed a CLI-first, agentic research tool leveraging LLMs for intelligent literature summarization
        - Implemented multi-source retrieval pipeline (ArXiv, Semantic Scholar) with robust rate-limiting
        - Achieved **13.9x speedup** in literature acquisition through structured prompting strategies

        ### Mobile Side-Channel Attack: Keystroke Inference
        *Oct 2025 - Dec 2025* | [GitHub](https://github.com/East-Hu)
        - Developed an Android application to collect high-frequency sensory data for side-channel analysis
        - Designed and trained a hybrid CNN-GRU deep learning model for password inference
        - Analyzed spatial-temporal features of keystroke dynamics for privacy vulnerability research
    design:
      columns: '1'

  - block: markdown
    id: teaching
    content:
      title: '📚 Teaching Experience'
      subtitle: ''
      text: |-
        ### Graduate Teaching Assistant
        *Georgia State University | Jan 2025 - Present*
        - **Grader** for CSC 6330 (Programming Language Concepts) & CSC 8230 (Secure and Private AI)
        - Assessed graduate-level assignments and exams; authored original problem sets and code samples

        ### Lab Instructor
        *Georgia State University | Jan 2026 - Present*
        - **Lab Instructor** for CSC 1302L (Principles of Computer Science II)
        - Delivered weekly lab sessions on Python and data structures to undergraduate students
    design:
      columns: '1'

  - block: markdown
    id: awards
    content:
      title: '🏆 Honors & Awards'
      subtitle: ''
      text: |-
        - **Graduation Honorary Certificate** - Zhejiang University (2024)
        - **Team Silver Medal** - 8th China Group Programming Ladder Tournament (2023)
        - **Team Bronze Medal** - 7th China Group Programming Ladder Tournament (2022)
        - **Bronze Medal** - 2023 Zhejiang Provincial Collegiate Programming Contest
        - **Bronze Medal** - 2022 Zhejiang Provincial Collegiate Programming Contest
        - **Bronze Medal** - 47th ICPC, Nanjing Site (2022)
        - **Bronze Medal** - 47th ICPC, Jinan Site (2022)
        - **Bronze Medal** - 46th ICPC, Kunming Site (2022)
        - **Bronze Medal** - CCPC, Weihai Site (2022)
    design:
      columns: '1'

  - block: collection
    id: papers
    content:
      title: Featured Publications
      filters:
        folders:
          - publications
        featured_only: true
    design:
      view: article-grid
      columns: 2

  - block: collection
    content:
      title: Recent Publications
      text: ''
      filters:
        folders:
          - publications
        exclude_featured: false
    design:
      view: citation

  - block: markdown
    id: skills
    content:
      title: '🛠️ Technical Skills'
      subtitle: ''
      text: |-
        | Category | Skills |
        |----------|--------|
        | **Languages** | Python, C/C++, Java, C#, SQL, JavaScript, HTML/CSS, LaTeX, R |
        | **AI & ML** | PyTorch, Hugging Face Transformers, LLM Agents, RAG, Prompt Engineering, Red Teaming |
        | **Graphics & 3D** | ModernGL, OpenGL, Unity, NeRF, StyleGAN, 3D Reconstruction |
        | **Tools** | Git, Docker, Linux/Bash, Flask, React, MySQL, AsyncIO |
    design:
      columns: '1'

  - block: markdown
    id: collaboration
    content:
      title: '🤝 Collaboration'
      subtitle: ''
      text: |-
        If you are a researcher interested in collaborating, please feel free to contact me at [Easton.Hu@uga.edu](mailto:Easton.Hu@uga.edu).
    design:
      columns: '1'
---
