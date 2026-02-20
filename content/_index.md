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
    id: news
    content:
      title: '📰 Latest News'
      subtitle: ''
      text: |-
        - **May 2026**: Started Ph.D program at University of Georgia under the guidance of Dr. Jian Liu!
        - **May 2026**: Graduated from Georgia State University with M.S. in Computer Science!
        - **January 2026**: One paper was submitted to ACL 2026!
        - **September 2025**: One paper was submitted to IEEE Internet of Things Journal!
        - **January 2025**: Started M.S. program at Georgia State University.
        - **June 2024**: Completed Bachelor's degree and graduated from NingboTech University, along with Graduation Honorary Certificate from Zhejiang University.
    design:
      columns: '1'

  - block: markdown
    id: research
    content:
      title: '🔬 Research Experience'
      subtitle: ''
      text: |-
        #### GAMBIT: Gamified Jailbreak Framework for Multimodal LLMs
        *Georgia State University, INSPIRE Lab*
        - Proposed a novel framework utilizing 'Puzzle-based Multimodal Encoding' to disrupt visual semantic filters
        - Identified and formalized the 'Safety-Complexity Trade-off' in Multimodal LLMs
        - Achieved state-of-the-art Attack Success Rates (ASR) on popular models
        - **Submitted to ACL 2026** | [arXiv](https://arxiv.org/abs/2601.03416)

        #### Straggler Mitigation in Blockchain-based Hierarchical Federated Learning
        *Georgia State University, INSPIRE Lab*
        - Proposed a decentralized BHFL framework utilizing Raft-based consortium blockchain
        - Designed 'HieAvg', a novel hierarchical averaging algorithm with theoretical convergence proof
        - Validated performance improvements on Raspberry Pi and AWS EC2 testbeds
        - **Submitted to IEEE Internet of Things Journal** | [arXiv](https://arxiv.org/abs/2308.01296)
    design:
      columns: '1'

  # - block: markdown
  #   id: projects
  #   content:
  #     title: '💻 Open Source Projects'
  #     subtitle: ''
  #     text: |-
  #       ### PaperSeek: Agentic Research Assistant
  #       *Nov 2025 - Present* | [GitHub](https://github.com/East-Hu/PaperSeek)
  #       - Designed a CLI-first, agentic research tool leveraging LLMs for intelligent literature summarization
  #       - Implemented multi-source retrieval pipeline (ArXiv, Semantic Scholar) with robust rate-limiting
  #       - Achieved **13.9x speedup** in literature acquisition through structured prompting strategies
  #   design:
  #     columns: '1'

  - block: markdown
    id: teaching
    content:
      title: '📚 Teaching Experience'
      subtitle: ''
      text: |-
        - **Lab Instructor, Georgia State University**
          
          CSC 1302L: Principles of Computer Science II (Spring 2026)

        - **Teaching Assistant, Georgia State University**
          
          CSC 6330: Programming Language Concepts (Fall 2025)
          
          CSC 6330: Programming Language Concepts (Summer 2025)
          
          CSC 8230: Secure and Private AI (Spring 2025)
    design:
      columns: '1'

  - block: markdown
    id: awards
    content:
      title: '🏆 Honors & Awards'
      subtitle: ''
      text: |-
        <p style="font-size: 0.9rem;"><em>"I dedicated most of my undergraduate years to competitive programming. While the awards I earned during my four years as an ACMer were limited, the friends and experiences I made along the way are my greatest treasure."</em></p>

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

  - block: markdown
    id: collaboration
    content:
      title: '🤝 Collaboration'
      subtitle: ''
      text: |-
        If you are a researcher interested in collaborating, please feel free to contact me at [Easton.Hu@uga.edu](mailto:Easton.Hu@uga.edu).
    design:
      columns: '1'

  - block: markdown
    content:
      title: ''
      subtitle: ''
      text: |-
        <div id="map-container" style="display: flex; justify-content: center;">
          <script type="text/javascript" id="mapmyvisitors" src="//mapmyvisitors.com/map.js?d=s7IR6GNpbskwondQ33HOxiMKSc1SnG02RRQfC-IxvOQ&cl=ffffff&w=600"></script>
        </div>
        <script>
        document.addEventListener('DOMContentLoaded', function() {
          var c = document.getElementById('map-container');
          c.addEventListener('click', function(e) { e.preventDefault(); e.stopPropagation(); }, true);
          c.querySelectorAll('a').forEach(function(a) { a.removeAttribute('href'); a.style.cursor = 'default'; });
          new MutationObserver(function() {
            c.querySelectorAll('a').forEach(function(a) { a.removeAttribute('href'); a.style.cursor = 'default'; });
          }).observe(c, {childList: true, subtree: true});
        });
        </script>
    design:
      columns: '1'
---
