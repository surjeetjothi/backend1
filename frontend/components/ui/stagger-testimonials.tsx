"use client"

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const SQRT_5000 = Math.sqrt(5000);

const testimonials = [
    {
        tempId: 0,
        testimonial: "My favorite solution in the market. We work 5x faster with COMPANY.",
        by: "Alex, CEO at TechCorp",
        imgSrc: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&w=150&q=80"
    },
    {
        tempId: 1,
        testimonial: "I'm confident my data is safe with COMPANY. I can't say that about other providers.",
        by: "Dan, CTO at SecureNet",
        imgSrc: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80"
    },
    {
        tempId: 2,
        testimonial: "I know it's cliche, but we were lost before we found COMPANY. Can't thank you guys enough!",
        by: "Stephanie, COO at InnovateCo",
        imgSrc: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80"
    },
    {
        tempId: 3,
        testimonial: "COMPANY's products make planning for the future seamless. Can't recommend them enough!",
        by: "Marie, CFO at FuturePlanning",
        imgSrc: "https://images.unsplash.com/photo-1554151228-14d9def656ec?auto=format&fit=crop&w=150&q=80"
    },
    {
        tempId: 4,
        testimonial: "If I could give 11 stars, I'd give 12.",
        by: "Andre, Head of Design at CreativeSolutions",
        imgSrc: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80"
    },
    {
        tempId: 5,
        testimonial: "SO SO SO HAPPY WE FOUND YOU GUYS!!!! I'd bet you've saved me 100 hours so far.",
        by: "Jeremy, Product Manager at TimeWise",
        imgSrc: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80"
    },
    {
        tempId: 6,
        testimonial: "Took some convincing, but now that we're on COMPANY, we're never going back.",
        by: "Pam, Marketing Director at BrandBuilders",
        imgSrc: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
    },
    {
        tempId: 7,
        testimonial: "I would be lost without COMPANY's in-depth analytics. The ROI is EASILY 100X for us.",
        by: "Daniel, Data Scientist at AnalyticsPro",
        imgSrc: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=150&q=80"
    },
    {
        tempId: 8,
        testimonial: "It's just the best. Period.",
        by: "Fernando, UX Designer at UserFirst",
        imgSrc: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80"
    },
    {
        tempId: 9,
        testimonial: "I switched 5 years ago and never looked back.",
        by: "Andy, DevOps Engineer at CloudMasters",
        imgSrc: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=150&q=80"
    },
    {
        tempId: 10,
        testimonial: "I've been searching for a solution like COMPANY for YEARS. So glad I finally found one!",
        by: "Pete, Sales Director at RevenueRockets",
        imgSrc: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=150&q=80"
    },
    {
        tempId: 11,
        testimonial: "It's so simple and intuitive, we got the team up to speed in 10 minutes.",
        by: "Marina, HR Manager at TalentForge",
        imgSrc: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80"
    },
    {
        tempId: 12,
        testimonial: "COMPANY's customer support is unparalleled. They're always there when we need them.",
        by: "Olivia, Customer Success Manager at ClientCare",
        imgSrc: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=150&q=80"
    },
    {
        tempId: 13,
        testimonial: "The efficiency gains we've seen since implementing COMPANY are off the charts!",
        by: "Raj, Operations Manager at StreamlineSolutions",
        imgSrc: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=150&q=80"
    },
    {
        tempId: 14,
        testimonial: "COMPANY has revolutionized how we handle our workflow. It's a game-changer!",
        by: "Lila, Workflow Specialist at ProcessPro",
        imgSrc: "https://images.unsplash.com/photo-1607746882042-944635dfe10e?auto=format&fit=crop&w=150&q=80"
    },
    {
        tempId: 15,
        testimonial: "The scalability of COMPANY's solution is impressive. It grows with our business seamlessly.",
        by: "Trevor, Scaling Officer at GrowthGurus",
        imgSrc: "https://images.unsplash.com/photo-1542909168-82c3e7fdca5c?auto=format&fit=crop&w=150&q=80"
    },
    {
        tempId: 16,
        testimonial: "I appreciate how COMPANY continually innovates. They're always one step ahead.",
        by: "Naomi, Innovation Lead at FutureTech",
        imgSrc: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=150&q=80"
    },
    {
        tempId: 17,
        testimonial: "The ROI we've seen with COMPANY is incredible. It's paid for itself many times over.",
        by: "Victor, Finance Analyst at ProfitPeak",
        imgSrc: "https://images.unsplash.com/photo-1500917293891-ef795e70e1f6?auto=format&fit=crop&w=150&q=80"
    },
    {
        tempId: 18,
        testimonial: "COMPANY's platform is so robust, yet easy to use. It's the perfect balance.",
        by: "Yuki, Tech Lead at BalancedTech",
        imgSrc: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=150&q=80"
    },
    {
        tempId: 19,
        testimonial: "We've tried many solutions, but COMPANY stands out in terms of reliability and performance.",
        by: "Zoe, Performance Manager at ReliableSystems",
        imgSrc: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80"
    }
];

interface TestimonialCardProps {
    position: number;
    testimonial: typeof testimonials[0];
    handleMove: (steps: number) => void;
    cardSize: number;
}

const TestimonialCard: React.FC<TestimonialCardProps> = ({
    position,
    testimonial,
    handleMove,
    cardSize
}) => {
    const isCenter = position === 0;

    return (
        <div
            onClick={() => handleMove(position)}
            className={cn(
                "absolute left-1/2 top-1/2 cursor-pointer border-2 p-8 transition-all duration-500 ease-in-out",
                isCenter
                    ? "z-10 bg-primary text-primary-foreground border-primary"
                    : "z-0 bg-card text-card-foreground border-border hover:border-primary/50"
            )}
            style={{
                width: cardSize,
                height: cardSize,
                clipPath: `polygon(50px 0%, calc(100% - 50px) 0%, 100% 50px, 100% 100%, calc(100% - 50px) 100%, 50px 100%, 0 100%, 0 0)`,
                transform: `
          translate(-50%, -50%) 
          translateX(${(cardSize / 1.5) * position}px)
          translateY(${isCenter ? -65 : position % 2 ? 15 : -15}px)
          rotate(${isCenter ? 0 : position % 2 ? 2.5 : -2.5}deg)
        `,
                boxShadow: isCenter ? "0px 8px 0px 4px hsl(var(--border))" : "0px 0px 0px 0px transparent"
            }}
        >
            <span
                className="absolute block origin-top-right rotate-45 bg-border"
                style={{
                    right: -2,
                    top: 48,
                    width: SQRT_5000,
                    height: 2
                }}
            />
            <img
                src={testimonial.imgSrc}
                alt={`${testimonial.by.split(',')[0]}`}
                className="mb-4 h-14 w-12 bg-muted object-cover object-top"
                style={{
                    boxShadow: "3px 3px 0px hsl(var(--background))"
                }}
            />
            <h3 className={cn(
                "text-base sm:text-xl font-medium",
                isCenter ? "text-primary-foreground" : "text-foreground"
            )}>
                "{testimonial.testimonial}"
            </h3>
            <p className={cn(
                "absolute bottom-8 left-8 right-8 mt-2 text-sm italic",
                isCenter ? "text-primary-foreground/80" : "text-muted-foreground"
            )}>
                - {testimonial.by}
            </p>
        </div>
    );
};

export const StaggerTestimonials: React.FC = () => {
    const [cardSize, setCardSize] = useState(365);
    const [testimonialsList, setTestimonialsList] = useState(testimonials);

    const handleMove = (steps: number) => {
        const newList = [...testimonialsList];
        if (steps > 0) {
            for (let i = steps; i > 0; i--) {
                const item = newList.shift();
                if (!item) return;
                newList.push({ ...item, tempId: Math.random() });
            }
        } else {
            for (let i = steps; i < 0; i++) {
                const item = newList.pop();
                if (!item) return;
                newList.unshift({ ...item, tempId: Math.random() });
            }
        }
        setTestimonialsList(newList);
    };

    useEffect(() => {
        const updateSize = () => {
            const { matches } = window.matchMedia("(min-width: 640px)");
            setCardSize(matches ? 365 : 290);
        };

        updateSize();
        window.addEventListener("resize", updateSize);
        return () => window.removeEventListener("resize", updateSize);
    }, []);

    return (
        <div
            className="relative w-full overflow-hidden bg-muted/30"
            style={{ height: 600 }}
        >
            {testimonialsList.map((testimonial, index) => {
                const position = testimonialsList.length % 2
                    ? index - (testimonialsList.length + 1) / 2
                    : index - testimonialsList.length / 2;
                return (
                    <TestimonialCard
                        key={testimonial.tempId}
                        testimonial={testimonial}
                        handleMove={handleMove}
                        position={position}
                        cardSize={cardSize}
                    />
                );
            })}
            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
                <button
                    onClick={() => handleMove(-1)}
                    className={cn(
                        "flex h-14 w-14 items-center justify-center text-2xl transition-colors",
                        "bg-background border-2 border-border hover:bg-primary hover:text-primary-foreground",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    )}
                    aria-label="Previous testimonial"
                >
                    <ChevronLeft />
                </button>
                <button
                    onClick={() => handleMove(1)}
                    className={cn(
                        "flex h-14 w-14 items-center justify-center text-2xl transition-colors",
                        "bg-background border-2 border-border hover:bg-primary hover:text-primary-foreground",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    )}
                    aria-label="Next testimonial"
                >
                    <ChevronRight />
                </button>
            </div>
        </div>
    );
};
