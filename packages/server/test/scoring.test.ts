import { describe, expect, it } from 'bun:test'
import { scoreIq, scoreSpeed } from './../src/scoring'

describe('Scoring Functions', () => {
  describe('scoreIq', () => {
    it('should return 0 for undefined intelligence index', () => {
      expect(scoreIq(undefined)).toBe(0)
    })

    it('should return 0 for intelligence index < 25', () => {
      expect(scoreIq(20)).toBe(0)
      expect(scoreIq(24)).toBe(0)
    })

    it('should return 1 for intelligence index 25-34', () => {
      expect(scoreIq(25)).toBe(1)
      expect(scoreIq(30)).toBe(1)
      expect(scoreIq(34)).toBe(1)
    })

    it('should return 2 for intelligence index 35-44', () => {
      expect(scoreIq(35)).toBe(2)
      expect(scoreIq(40)).toBe(2)
      expect(scoreIq(44)).toBe(2)
    })

    it('should return 3 for intelligence index 45-54', () => {
      expect(scoreIq(45)).toBe(3)
      expect(scoreIq(50)).toBe(3)
      expect(scoreIq(54)).toBe(3)
    })

    it('should return 4 for intelligence index 55-64', () => {
      expect(scoreIq(55)).toBe(4)
      expect(scoreIq(60)).toBe(4)
      expect(scoreIq(64)).toBe(4)
    })

    it('should return 5 for intelligence index >= 65', () => {
      expect(scoreIq(65)).toBe(5)
      expect(scoreIq(70)).toBe(5)
      expect(scoreIq(100)).toBe(5)
    })
  })

  describe('scoreSpeed', () => {
    it('should return 0 for undefined tokens per second', () => {
      expect(scoreSpeed(undefined)).toBe(0)
    })

    it('should return 0 for speed < 25', () => {
      expect(scoreSpeed(20)).toBe(0)
      expect(scoreSpeed(24)).toBe(0)
    })

    it('should return 1 for speed 25-49', () => {
      expect(scoreSpeed(25)).toBe(1)
      expect(scoreSpeed(40)).toBe(1)
      expect(scoreSpeed(49)).toBe(1)
    })

    it('should return 2 for speed 50-99', () => {
      expect(scoreSpeed(50)).toBe(2)
      expect(scoreSpeed(75)).toBe(2)
      expect(scoreSpeed(99)).toBe(2)
    })

    it('should return 3 for speed 100-199', () => {
      expect(scoreSpeed(100)).toBe(3)
      expect(scoreSpeed(150)).toBe(3)
      expect(scoreSpeed(199)).toBe(3)
    })

    it('should return 4 for speed 200-299', () => {
      expect(scoreSpeed(200)).toBe(4)
      expect(scoreSpeed(250)).toBe(4)
      expect(scoreSpeed(299)).toBe(4)
    })

    it('should return 5 for speed >= 300', () => {
      expect(scoreSpeed(300)).toBe(5)
      expect(scoreSpeed(350)).toBe(5)
      expect(scoreSpeed(500)).toBe(5)
    })
  })
})
