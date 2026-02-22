'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Calendar, MapPin } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface HeroEvent {
  id: string;
  title: string;
  description: string;
  startTime: string;
  location: string | null;
  city: string | null;
  state: string | null;
  imageUrl: string | null;
}

interface HeroCarouselProps {
  events: HeroEvent[];
  autoPlayInterval?: number;
}

export const HeroCarousel: React.FC<HeroCarouselProps> = ({
  events,
  autoPlayInterval = 6000,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % events.length);
  }, [events.length]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + events.length) % events.length);
  }, [events.length]);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  // Auto-play functionality
  useEffect(() => {
    if (!isAutoPlaying || events.length <= 1) return;

    const interval = setInterval(goToNext, autoPlayInterval);
    return () => clearInterval(interval);
  }, [isAutoPlaying, autoPlayInterval, goToNext, events.length]);

  // Pause auto-play on hover
  const handleMouseEnter = () => setIsAutoPlaying(false);
  const handleMouseLeave = () => setIsAutoPlaying(true);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  if (events.length === 0) {
    return null;
  }

  const currentEvent = events[currentIndex];

  return (
    <section
      className="relative h-[500px] md:h-[600px] overflow-hidden bg-dark-bg"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Background Images */}
      {events.map((event, index) => (
        <div
          key={event.id}
          className={cn(
            'absolute inset-0 transition-opacity duration-700 ease-in-out',
            index === currentIndex ? 'opacity-100' : 'opacity-0'
          )}
        >
          {event.imageUrl ? (
            <Image
              src={event.imageUrl}
              alt={event.title}
              fill
              priority={index === 0}
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-accent-900 to-dark-bg" />
          )}
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-dark-bg via-dark-bg/60 to-transparent" />
        </div>
      ))}

      {/* Content */}
      <div className="relative container mx-auto px-4 h-full flex items-end pb-16">
        <div className="max-w-2xl">
          {/* Date Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent/90 backdrop-blur-sm rounded-lg mb-4">
            <Calendar className="w-4 h-4 text-white" />
            <span className="text-white font-medium text-sm">
              {formatDate(currentEvent.startTime)}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-white mb-4 leading-tight">
            {currentEvent.title}
          </h1>

          {/* Description */}
          <p className="text-lg text-white/80 mb-6 line-clamp-2">
            {currentEvent.description}
          </p>

          {/* Location */}
          {(currentEvent.city || currentEvent.location) && (
            <div className="flex items-center gap-2 text-white/70 mb-6">
              <MapPin className="w-5 h-5" />
              <span className="text-base">
                {currentEvent.city && currentEvent.state
                  ? `${currentEvent.location || ''}, ${currentEvent.city}, ${currentEvent.state}`
                  : currentEvent.location}
              </span>
            </div>
          )}

          {/* CTA Button */}
          <Link
            href={`/events/${currentEvent.id}`}
            className="inline-flex items-center px-6 py-3 bg-accent hover:bg-accent-600 text-white font-semibold rounded-lg transition-colors"
          >
            Ver Detalhes
          </Link>
        </div>
      </div>

      {/* Navigation Arrows */}
      {events.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 backdrop-blur-sm hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
            aria-label="Evento anterior"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={goToNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 backdrop-blur-sm hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
            aria-label="Próximo evento"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Dots Navigation */}
      {events.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2">
          {events.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={cn(
                'w-3 h-3 rounded-full transition-all duration-300',
                index === currentIndex
                  ? 'bg-accent w-8'
                  : 'bg-white/40 hover:bg-white/60'
              )}
              aria-label={`Ir para evento ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Event Counter */}
      <div className="absolute top-4 right-4 px-3 py-1.5 bg-black/40 backdrop-blur-sm rounded-full text-white/80 text-sm">
        {currentIndex + 1} / {events.length}
      </div>
    </section>
  );
};
