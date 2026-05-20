# Promises and Perils of Connectome-Constrained Neuro-AI Models

A one-day workshop at OHBM 2026. Below is the full programme. Times in 24h. The format is `HH:MM – HH:MM · Speaker name`. The `###` line is the talk title; everything below it (until the next `##`) is the abstract.

You can edit, reorder or add talks here. The timeline on the site rebuilds from this file — the bar next to each speaker circle stretches from start time to end time.

## 09:00 – 09:15 · Kayson Fakhar, Fatemeh Hadaeghi & Duncan Astle
### Opening

Welcome and orientation. A brief overview of the day's structure and the questions the workshop sets out to explore.

## 09:15 – 09:45 · Dan Goodman
### An introduction to Neuro-AI and how it can help with testing neuroscience hypotheses

This talk introduces the field and its history with examples on how artificial neural network models could be used to form and test neuroscientific hypotheses. For instance, is functional modularity a computational trick or just a byproduct of other physical constraints?

## 09:45 – 10:15 · Shahab Bakhtiari
### How task structure shapes representational geometry in neural networks

Representational geometry and low dimensional decodable neural manifolds are key concepts in both neuroscience and neuro-AI models. This talk introduces these concepts and emphasises on the often neglected but crucial role of task structure in shaping neural activity.

## 10:15 – 10:45 · Richard Gao
### Beyond Neuro-AI: We need AI for Neuro and we're going to suck at it

This talk concludes the series on Neuro-AI by asking: what is the difference between Neuro-AI and AI for Neuro? It explains the difference between using AI to assist in computational modeling and data analysis for neuroscience, versus understanding computations in neural and artificial systems, with illustrative examples and a roadmap for a synergistic methodological research program that includes both.

## 10:45 – 11:00 · Break
### Coffee break

Stretch, refill, and find a seat for the next block.

## 11:00 – 11:30 · Fatemeh Hadaeghi
### An introduction to connectome-constrained RNNs and reservoir computing models

This talk provides a non-technical introduction to neuromorphic computing and its essential ingredients. It then showcases examples of how to incorporate different biological constraints and how to interpret the results.

## 11:30 – 12:00 · Petra E. Vértes
### Reservoir computing as a window into structure–function relationships in neural systems

This talk concludes the series on neuromorphic computing by providing integrative examples where structure and function is studied. It illustrates a few pitfalls and challenges that are yet to solve while discussing ways it can be further developed.

## 12:00 – 12:30 · Joao Barbosa
### Normative modelling with brain-inspired recurrent neural networks

Flexible decision-making is often attributed to prefrontal control, yet recent work shows that task-relevant information is distributed across many regions. Using population analyses and data-constrained recurrent networks applied to a multi-region monkey dataset, we identify region-specific computations that standard decoding misses. Sensory areas show higher internal than communicated dimensionality, whereas frontal regions transmit most of what they compute. Dimensionality decreases along the hierarchy, indicating increasingly abstract transformations. In-silico perturbations reveal that choices emerge from strengthened cross-regional interactions, while sensory encoding remains stable and bottom-up. These results show that even when information is widespread, distinct regions perform specialized transformations during flexible decisions.

## 12:30 – 13:00 · Marcus Ghosh
### Not playing around: why neuroscience needs toy models

There is a trend towards building bigger, more "brain-like" models in NeuroAI. For instance, one recent model uses 70 billion parameters to perform simple psychophysics tasks. At this scale, these models are almost as complex, and challenging to interpret, as their biological counterparts. By contrast, smaller "toy" models, with say 2 to 3 neurons, offer a highly interpretable and practical framework for studying neural circuits. In this talk, I will argue that toy models remain essential, and may be all neuroscience needs. As a motivating example, I will present our work on linking structure to function in partially recurrent neural networks (pRNNs).

## 13:00 – 14:30 · Lunch
### Long break

Lunch break and informal discussion. Reconvene at 14:30 for the hackathon.

## 14:30 – 16:00 · Hackathon
### Hands-on session

A 90-minute hackathon. Bring a laptop; we'll provide starter notebooks containing exercises for the connectome-constrained RNN and reservoir-computing tasks introduced in the morning. There will be three projects:
1. **Connectome-constrained RNNs**: Build and train a recurrent neural network with connectivity inspired by a real brain connectome. Explore how the structure of the connectome influences the network's dynamics and performance on a simple task.
2. **Reservoir computing**: Implement a reservoir computing model using a randomly connected recurrent network. Train a readout layer to perform a simple temporal task, and investigate how the properties of the reservoir affect learning and generalization.
3. **Partially recurrent neural networks (pRNNs)**: Create a simple toy model with a small set of neurons to study the link between structure and function in neural circuits.

## 16:00 – 16:30 · Danyal Akarca
### Beyond weights: Toward space, time, and heterogeneity in neural networks

The brain has long served as an abstraction for computation, and neural networks emerged from this tradition. Yet modern deep learning has largely pursued a different path: scaling parameters and inference-time compute. While remarkably successful, this represents a narrow slice of what's possible. This talk argues for a broader view — approaches that move beyond weights alone to incorporate space, time, and other forms of heterogeneity, as inspired by biological neural systems. I will show how trainable delays and spatial structure can be used successfully for learning, and how dynamical systems methods offer new tools for understanding and interpreting computation in these networks. Together, these directions illustrate how deep computational principles drawn from the brain, and nature more broadly, can inform both algorithm design and the hardware that runs them.

## 16:30 – 17:00 · Claus C. Hilgetag
### Open challenges of brain-inspired artificial neural network models

Neuro-AI is still at its infancy, with great potential for efficient, high-performance AI. However, there are several open challenges that need to be addressed before getting too excited about Neuro-AI's promises. For example, how do we bridge the gap across different neural scales? How relevant are Neuro-AI architectures for real-world applications, e.g. in the clinical sector? And most importantly, in this golden age of LLMs, how much of more realistically neuro-inspired AI is really relevant?

## 17:00 – 17:30 · Panel discussion · All speakers
### Open questions, friendly disagreements

A closing roundtable with all speakers, where we just sit and chat.
